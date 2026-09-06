package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	// DefaultResendBaseURL is the standard API URL for Resend.
	DefaultResendBaseURL = "https://api.resend.com"
	// SandboxSender is Resend's default onboarding sender for testing before custom domains.
	SandboxSender = "onboarding@resend.dev"
)

// EmailRequest represents a single email to be sent via Resend.
type EmailRequest struct {
	From    string            `json:"from"`
	To      []string          `json:"to"`
	Subject string            `json:"subject"`
	Html    string            `json:"html,omitempty"`
	Text    string            `json:"text,omitempty"`
	Tags    []EmailTag        `json:"tags,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`
}

// EmailTag represents metadata tag key-value pairs for Resend analytics.
type EmailTag struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// EmailResponse is the result returned by Resend on success.
type EmailResponse struct {
	ID string `json:"id"`
}

// EmailSender defines the interface for dispatching emails, enabling test mocks per ADR-007.
type EmailSender interface {
	Send(ctx context.Context, req EmailRequest) (*EmailResponse, error)
	SendBatch(ctx context.Context, reqs []EmailRequest) ([]EmailResponse, error)
}

// ResendConfig holds client credentials and configuration.
type ResendConfig struct {
	APIKey     string
	BaseURL    string
	FromSender string
	HTTPClient *http.Client
}

// ResendClient implements EmailSender against the live Resend HTTP API.
type ResendClient struct {
	apiKey     string
	baseURL    string
	fromSender string
	client     *http.Client
}

// NewResendClient creates a configured Resend client.
func NewResendClient(cfg ResendConfig) (*ResendClient, error) {
	if cfg.APIKey == "" {
		return nil, errors.New("RESEND_API_KEY is required")
	}

	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = DefaultResendBaseURL
	}

	fromSender := cfg.FromSender
	if fromSender == "" {
		fromSender = SandboxSender
	}

	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 10 * time.Second}
	}

	return &ResendClient{
		apiKey:     cfg.APIKey,
		baseURL:    strings.TrimRight(baseURL, "/"),
		fromSender: fromSender,
		client:     httpClient,
	}, nil
}

// Send dispatches a single email to the Resend /emails endpoint.
func (c *ResendClient) Send(ctx context.Context, req EmailRequest) (*EmailResponse, error) {
	if req.From == "" {
		req.From = c.fromSender
	}
	if len(req.To) == 0 {
		return nil, errors.New("email recipient list cannot be empty")
	}

	bodyBytes, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal email request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/emails", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute resend request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("resend API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	var emailResp EmailResponse
	if err := json.Unmarshal(respBody, &emailResp); err != nil {
		return nil, fmt.Errorf("failed to parse resend response: %w", err)
	}

	return &emailResp, nil
}

// SendBatch dispatches a batch of emails to the Resend /emails/batch endpoint.
func (c *ResendClient) SendBatch(ctx context.Context, reqs []EmailRequest) ([]EmailResponse, error) {
	if len(reqs) == 0 {
		return []EmailResponse{}, nil
	}

	for i := range reqs {
		if reqs[i].From == "" {
			reqs[i].From = c.fromSender
		}
	}

	bodyBytes, err := json.Marshal(reqs)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal batch request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/emails/batch", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create batch http request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to execute resend batch request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("resend batch API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	type BatchWrapper struct {
		Data []EmailResponse `json:"data"`
	}

	var batchResp BatchWrapper
	if err := json.Unmarshal(respBody, &batchResp); err == nil && len(batchResp.Data) > 0 {
		return batchResp.Data, nil
	}

	// Fallback direct array unmarshal
	var directResp []EmailResponse
	if err := json.Unmarshal(respBody, &directResp); err != nil {
		return nil, fmt.Errorf("failed to parse batch response: %w", err)
	}

	return directResp, nil
}

// MockEmailSender stores dispatched emails in memory for deterministic unit testing.
type MockEmailSender struct {
	SentEmails      []EmailRequest
	FailNext        bool
	FailErr         error
	DefaultResponse *EmailResponse
}

// NewMockEmailSender initializes a new test mock email sender.
func NewMockEmailSender() *MockEmailSender {
	return &MockEmailSender{
		SentEmails:      make([]EmailRequest, 0),
		DefaultResponse: &EmailResponse{ID: "mock_email_123"},
	}
}

// Send records the email request in-memory or returns a simulated failure.
func (m *MockEmailSender) Send(ctx context.Context, req EmailRequest) (*EmailResponse, error) {
	if m.FailNext {
		m.FailNext = false
		if m.FailErr != nil {
			return nil, m.FailErr
		}
		return nil, errors.New("simulated send failure")
	}
	m.SentEmails = append(m.SentEmails, req)
	return m.DefaultResponse, nil
}

// SendBatch records batch emails in-memory.
func (m *MockEmailSender) SendBatch(ctx context.Context, reqs []EmailRequest) ([]EmailResponse, error) {
	if m.FailNext {
		m.FailNext = false
		if m.FailErr != nil {
			return nil, m.FailErr
		}
		return nil, errors.New("simulated batch failure")
	}
	m.SentEmails = append(m.SentEmails, reqs...)
	responses := make([]EmailResponse, len(reqs))
	for i := range reqs {
		responses[i] = EmailResponse{ID: fmt.Sprintf("mock_batch_%d", i+1)}
	}
	return responses, nil
}
