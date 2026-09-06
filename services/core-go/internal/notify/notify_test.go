package notify

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRegistrationMilestoneDecayRule(t *testing.T) {
	// Exact triangular numbers scaled by 10 per ADR-007
	validMilestones := []int{10, 30, 60, 100, 150, 210, 280, 360, 450, 550}
	for _, count := range validMilestones {
		if !IsRegistrationMilestone(count) {
			t.Errorf("expected count %d to be recognized as a registration milestone", count)
		}
	}

	// Non-milestones
	invalidCounts := []int{-10, 0, 1, 5, 9, 11, 20, 25, 29, 31, 40, 50, 70, 80, 90, 99, 101, 110, 120}
	for _, count := range invalidCounts {
		if IsRegistrationMilestone(count) {
			t.Errorf("expected count %d NOT to be recognized as a registration milestone", count)
		}
	}

	// Test NextRegistrationMilestone sequence
	testTransitions := []struct {
		current int
		next    int
	}{
		{0, 10},
		{5, 10},
		{10, 30},
		{15, 30},
		{30, 60},
		{60, 100},
		{100, 150},
		{150, 210},
		{210, 280},
		{280, 360},
	}

	for _, tc := range testTransitions {
		if got := NextRegistrationMilestone(tc.current); got != tc.next {
			t.Errorf("NextRegistrationMilestone(%d) = %d; want %d", tc.current, got, tc.next)
		}
	}
}

func TestNotificationService_Notify(t *testing.T) {
	mockSender := NewMockEmailSender()
	service := NewNotificationService(mockSender, "testnet")

	ctx := context.Background()
	event := NotificationEvent{
		EventID:       "evt_hackathon",
		EventTitle:    "Soroban Hackathon 2026",
		RecipientName: "Alice",
		ActionURL:     "https://astrea.xyz/events/evt_hackathon",
	}

	// Test valid send
	resp, err := service.Notify(ctx, TriggerParticipantRegistrationConfirmed, "alice@example.com", event)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp == nil || resp.ID != "mock_email_123" {
		t.Fatalf("expected valid email response, got %+v", resp)
	}
	if len(mockSender.SentEmails) != 1 {
		t.Fatalf("expected 1 sent email, got %d", len(mockSender.SentEmails))
	}

	sent := mockSender.SentEmails[0]
	if sent.To[0] != "alice@example.com" {
		t.Fatalf("expected recipient alice@example.com, got %s", sent.To[0])
	}
	if !strings.Contains(sent.Subject, "Registration Confirmed") {
		t.Fatalf("unexpected subject: %s", sent.Subject)
	}
	if !strings.Contains(sent.Text, "Soroban Hackathon 2026") {
		t.Fatalf("unexpected body: %s", sent.Text)
	}

	// Test payout send with auto-explorer URL
	payoutEvent := NotificationEvent{
		EventID:       "evt_payout",
		EventTitle:    "Soroban Hackathon 2026",
		RecipientName: "Alice",
		AmountUSDC:    "250.00",
		TxHash:        "abcdef1234567890abcdef",
	}
	_, err = service.Notify(ctx, TriggerParticipantPayoutSent, "alice@example.com", payoutEvent)
	if err != nil {
		t.Fatalf("unexpected error on payout notify: %v", err)
	}
	if len(mockSender.SentEmails) != 2 {
		t.Fatalf("expected 2 sent emails, got %d", len(mockSender.SentEmails))
	}

	payoutSent := mockSender.SentEmails[1]
	if !strings.Contains(payoutSent.Text, "stellar.expert/explorer/testnet/tx/abcdef1234567890abcdef") {
		t.Fatalf("expected explorer url in payout email body, got: %s", payoutSent.Text)
	}

	// Test empty recipient is no-op
	emptyResp, err := service.Notify(ctx, TriggerParticipantEventStarting, "", event)
	if err != nil {
		t.Fatalf("unexpected error on empty recipient: %v", err)
	}
	if emptyResp != nil {
		t.Fatalf("expected nil response for empty recipient, got %+v", emptyResp)
	}
}

func TestNotificationService_NotifyMilestoneIfEligible(t *testing.T) {
	mockSender := NewMockEmailSender()
	service := NewNotificationService(mockSender, "testnet")
	ctx := context.Background()

	event := NotificationEvent{
		EventID:       "evt_100",
		EventTitle:    "Builder Sprint",
		RecipientName: "Organizer Bob",
		ActionURL:     "https://astrea.xyz/organizer/evt_100",
	}

	// Count 25: not milestone -> fired = false
	event.Count = 25
	resp, fired, err := service.NotifyMilestoneIfEligible(ctx, "bob@example.com", event)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if fired || resp != nil || len(mockSender.SentEmails) != 0 {
		t.Fatalf("expected count 25 NOT to fire notification")
	}

	// Count 30: exact triangular milestone -> fired = true
	event.Count = 30
	resp, fired, err = service.NotifyMilestoneIfEligible(ctx, "bob@example.com", event)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !fired || resp == nil || len(mockSender.SentEmails) != 1 {
		t.Fatalf("expected count 30 to fire notification")
	}
	if !strings.Contains(mockSender.SentEmails[0].Subject, "30 Registrations") {
		t.Fatalf("expected subject to mention 30 registrations, got %s", mockSender.SentEmails[0].Subject)
	}
}

func TestNotificationService_NotifyBatch(t *testing.T) {
	mockSender := NewMockEmailSender()
	service := NewNotificationService(mockSender, "testnet")
	ctx := context.Background()

	event := NotificationEvent{
		EventID:    "evt_starting",
		EventTitle: "Mainnet Launchathon",
		ActionURL:  "https://astrea.xyz/events/evt_starting",
	}

	recipients := []string{"user1@astrea.xyz", "user2@astrea.xyz", "user3@astrea.xyz"}
	resps, err := service.NotifyBatch(ctx, TriggerParticipantEventStarting, recipients, event)
	if err != nil {
		t.Fatalf("unexpected batch send error: %v", err)
	}
	if len(resps) != 3 {
		t.Fatalf("expected 3 batch responses, got %d", len(resps))
	}
	if len(mockSender.SentEmails) != 3 {
		t.Fatalf("expected 3 emails dispatched to sender, got %d", len(mockSender.SentEmails))
	}
}

func TestResendClient_HTTPMock(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if auth != "Bearer re_test_key_123" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		if r.URL.Path == "/emails" {
			var req EmailRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"id":"email_real_mock_456"}`))
			return
		}

		if r.URL.Path == "/emails/batch" {
			var reqs []EmailRequest
			if err := json.NewDecoder(r.Body).Decode(&reqs); err != nil {
				http.Error(w, `{"error":"invalid batch json"}`, http.StatusBadRequest)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"data":[{"id":"b1"},{"id":"b2"}]}`))
			return
		}

		http.NotFound(w, r)
	}))
	defer server.Close()

	client, err := NewResendClient(ResendConfig{
		APIKey:     "re_test_key_123",
		BaseURL:    server.URL,
		FromSender: "onboarding@resend.dev",
	})
	if err != nil {
		t.Fatalf("failed to construct resend client: %v", err)
	}

	ctx := context.Background()

	// Single send test
	resp, err := client.Send(ctx, EmailRequest{
		To:      []string{"test@example.com"},
		Subject: "Hello Test",
		Text:    "Hello world",
	})
	if err != nil {
		t.Fatalf("failed to execute single send: %v", err)
	}
	if resp.ID != "email_real_mock_456" {
		t.Fatalf("expected id email_real_mock_456, got %s", resp.ID)
	}

	// Batch send test
	batchResps, err := client.SendBatch(ctx, []EmailRequest{
		{To: []string{"a@test.com"}, Subject: "A"},
		{To: []string{"b@test.com"}, Subject: "B"},
	})
	if err != nil {
		t.Fatalf("failed to execute batch send: %v", err)
	}
	if len(batchResps) != 2 || batchResps[0].ID != "b1" || batchResps[1].ID != "b2" {
		t.Fatalf("unexpected batch response: %+v", batchResps)
	}
}
