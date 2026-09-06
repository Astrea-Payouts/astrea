package notify

import (
	"context"
	"fmt"
)

// TriggerType categorizes notifications defined in ADR-007.
type TriggerType string

const (
	// Participant triggers
	TriggerParticipantRegistrationConfirmed TriggerType = "participant.registration_confirmed"
	TriggerParticipantTrustlineMissing      TriggerType = "participant.trustline_missing"
	TriggerParticipantEventStarting         TriggerType = "participant.event_starting"
	TriggerParticipantSubmissionDeadline    TriggerType = "participant.submission_deadline"
	TriggerParticipantEventCancelled        TriggerType = "participant.event_cancelled"
	TriggerParticipantWinnersAnnounced      TriggerType = "participant.winners_announced"
	TriggerParticipantPayoutSent            TriggerType = "participant.payout_sent"

	// Organizer triggers
	TriggerOrganizerEscrowFunded               TriggerType = "organizer.escrow_funded"
	TriggerOrganizerRegistrationMilestone      TriggerType = "organizer.registration_milestone"
	TriggerOrganizerSubmissionReceived         TriggerType = "organizer.submission_received"
	TriggerOrganizerEventStarting              TriggerType = "organizer.event_starting"
	TriggerOrganizerJudgingDeadlineApproaching TriggerType = "organizer.judging_deadline_approaching"
	TriggerOrganizerEventClosed                TriggerType = "organizer.event_closed"
	TriggerOrganizerDisputeOpened              TriggerType = "organizer.dispute_opened"

	// Judge triggers
	TriggerJudgeAssigned            TriggerType = "judge.assigned"
	TriggerJudgeSubmissionReceived  TriggerType = "judge.submission_received"
	TriggerJudgeDeadlineApproaching TriggerType = "judge.deadline_approaching"
	TriggerJudgeEventStarting       TriggerType = "judge.event_starting"

	// Resolver triggers
	TriggerResolverAssigned        TriggerType = "resolver.assigned"
	TriggerResolverActionNeeded    TriggerType = "resolver.action_needed"
	TriggerResolverEventStarting   TriggerType = "resolver.event_starting"
	TriggerResolverDisputeResolved TriggerType = "resolver.dispute_resolved"

	// Internal alerts
	TriggerInternalSupportRequest          TriggerType = "internal.support_request"
	TriggerInternalDefaultResolverAction   TriggerType = "internal.default_resolver_action"
)

// NotificationService coordinates rendering and dispatching notifications.
type NotificationService struct {
	sender  EmailSender
	network string
}

// NewNotificationService constructs a NotificationService with the provided sender and network.
func NewNotificationService(sender EmailSender, network string) *NotificationService {
	if network == "" {
		network = "testnet"
	}
	return &NotificationService{
		sender:  sender,
		network: network,
	}
}

// Notify renders and sends a single notification to a recipient.
func (s *NotificationService) Notify(
	ctx context.Context,
	trigger TriggerType,
	recipientEmail string,
	event NotificationEvent,
) (*EmailResponse, error) {
	if recipientEmail == "" {
		return nil, nil // No-op if email is unconfigured/optional
	}

	if event.TxHash != "" && event.ExplorerURL == "" {
		event.ExplorerURL = BuildExplorerURL(s.network, event.TxHash)
	}

	subject, textBody, htmlBody := RenderTemplate(trigger, event)

	req := EmailRequest{
		To:      []string{recipientEmail},
		Subject: subject,
		Text:    textBody,
		Html:    htmlBody,
		Tags: []EmailTag{
			{Name: "trigger", Value: string(trigger)},
			{Name: "event_id", Value: event.EventID},
		},
	}

	return s.sender.Send(ctx, req)
}

// NotifyMilestoneIfEligible checks the registration decay rule and sends a milestone notification
// only when currentCount equals an exact triangular threshold (10, 30, 60, 100, 150, 210, 280, 360...).
// Returns (response, fired, error).
func (s *NotificationService) NotifyMilestoneIfEligible(
	ctx context.Context,
	organizerEmail string,
	event NotificationEvent,
) (*EmailResponse, bool, error) {
	if !IsRegistrationMilestone(event.Count) {
		return nil, false, nil
	}

	resp, err := s.Notify(ctx, TriggerOrganizerRegistrationMilestone, organizerEmail, event)
	if err != nil {
		return nil, true, fmt.Errorf("failed to dispatch milestone notification: %w", err)
	}
	return resp, true, nil
}

// NotifyBatch dispatches notifications to multiple recipients (e.g. all registrants for event starting)
// using Resend's batch endpoint for high efficiency and atomic request fan-out.
func (s *NotificationService) NotifyBatch(
	ctx context.Context,
	trigger TriggerType,
	recipientEmails []string,
	event NotificationEvent,
) ([]EmailResponse, error) {
	if len(recipientEmails) == 0 {
		return []EmailResponse{}, nil
	}

	if event.TxHash != "" && event.ExplorerURL == "" {
		event.ExplorerURL = BuildExplorerURL(s.network, event.TxHash)
	}

	subject, textBody, htmlBody := RenderTemplate(trigger, event)
	reqs := make([]EmailRequest, 0, len(recipientEmails))

	for _, email := range recipientEmails {
		if email == "" {
			continue
		}
		reqs = append(reqs, EmailRequest{
			To:      []string{email},
			Subject: subject,
			Text:    textBody,
			Html:    htmlBody,
			Tags: []EmailTag{
				{Name: "trigger", Value: string(trigger)},
				{Name: "event_id", Value: event.EventID},
			},
		})
	}

	if len(reqs) == 0 {
		return []EmailResponse{}, nil
	}

	return s.sender.SendBatch(ctx, reqs)
}
