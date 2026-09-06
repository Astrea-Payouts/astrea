package notify

import (
	"fmt"
	"strings"
)

// NotificationEvent represents the data payload for rendering notification templates.
type NotificationEvent struct {
	EventID       string
	EventTitle    string
	RecipientName string
	RecipientRole string // participant, organizer, judge, resolver, internal
	AmountUSDC    string
	TxHash        string
	ExplorerURL   string
	Count         int
	Deadline      string
	Reason        string
	ActionURL     string
}

// BuildExplorerURL generates the stellar.expert explorer URL for a given transaction hash.
func BuildExplorerURL(network, txHash string) string {
	if txHash == "" {
		return ""
	}
	if strings.ToLower(network) == "mainnet" {
		return fmt.Sprintf("https://stellar.expert/explorer/public/tx/%s", txHash)
	}
	return fmt.Sprintf("https://stellar.expert/explorer/testnet/tx/%s", txHash)
}

// RenderTemplate generates the subject, plain-text body, and HTML body for a notification trigger.
func RenderTemplate(trigger TriggerType, event NotificationEvent) (subject string, textBody string, htmlBody string) {
	switch trigger {
	case TriggerParticipantRegistrationConfirmed:
		subject = fmt.Sprintf("Registration Confirmed: %s", event.EventTitle)
		textBody = fmt.Sprintf("Hi %s,\n\nYou have successfully registered for %s.\nView event details: %s\n\n- The Astrea Team",
			event.RecipientName, event.EventTitle, event.ActionURL)
		htmlBody = fmt.Sprintf("<p>Hi %s,</p><p>You have successfully registered for <strong>%s</strong>.</p><p><a href=\"%s\">View Event Details</a></p><p>- The Astrea Team</p>",
			event.RecipientName, event.EventTitle, event.ActionURL)

	case TriggerParticipantTrustlineMissing:
		subject = fmt.Sprintf("Action Required: USDC Trustline Missing for %s", event.EventTitle)
		textBody = fmt.Sprintf("Hi %s,\n\nYour connected wallet does not currently have a USDC trustline established on Stellar. Without this, prize payouts cannot be disbursed.\n\nPlease establish your trustline: %s\n\n- The Astrea Team",
			event.RecipientName, event.ActionURL)
		htmlBody = fmt.Sprintf("<p>Hi %s,</p><p>Your connected wallet does not currently have a USDC trustline established on Stellar. Without this, prize payouts cannot be disbursed.</p><p><a href=\"%s\">Establish Trustline Now</a></p><p>- The Astrea Team</p>",
			event.RecipientName, event.ActionURL)

	case TriggerParticipantPayoutSent:
		subject = fmt.Sprintf("Prize Payout Sent: %s USDC for %s", event.AmountUSDC, event.EventTitle)
		textBody = fmt.Sprintf("Congratulations %s!\n\nYour prize of %s USDC has been disbursed on-chain for %s.\n\nTransaction Hash: %s\nExplorer: %s\n\n- The Astrea Team",
			event.RecipientName, event.AmountUSDC, event.EventTitle, event.TxHash, event.ExplorerURL)
		htmlBody = fmt.Sprintf("<p>Congratulations %s!</p><p>Your prize of <strong>%s USDC</strong> has been disbursed on-chain for <strong>%s</strong>.</p><p><strong>Tx Hash:</strong> <code>%s</code></p><p><a href=\"%s\">View on Stellar Expert</a></p><p>- The Astrea Team</p>",
			event.RecipientName, event.AmountUSDC, event.EventTitle, event.TxHash, event.ExplorerURL)

	case TriggerOrganizerEscrowFunded:
		subject = fmt.Sprintf("Event Funded & Ready: %s", event.EventTitle)
		textBody = fmt.Sprintf("Hi %s,\n\nYour event escrow for %s has been funded (%s USDC) and prerequisite conditions are met. You can now manually start the event when ready.\n\nDashboard: %s\n\n- The Astrea Team",
			event.RecipientName, event.EventTitle, event.AmountUSDC, event.ActionURL)
		htmlBody = fmt.Sprintf("<p>Hi %s,</p><p>Your event escrow for <strong>%s</strong> has been funded (<strong>%s USDC</strong>) and prerequisite conditions are met. You can now manually start the event when ready.</p><p><a href=\"%s\">Go to Organizer Dashboard</a></p><p>- The Astrea Team</p>",
			event.RecipientName, event.EventTitle, event.AmountUSDC, event.ActionURL)

	case TriggerOrganizerRegistrationMilestone:
		subject = fmt.Sprintf("Milestone Reached: %d Registrations for %s", event.Count, event.EventTitle)
		textBody = fmt.Sprintf("Hi %s,\n\nGreat news! Your event %s just reached %d registered participants.\n\nDashboard: %s\n\n- The Astrea Team",
			event.RecipientName, event.EventTitle, event.Count, event.ActionURL)
		htmlBody = fmt.Sprintf("<p>Hi %s,</p><p>Great news! Your event <strong>%s</strong> just reached <strong>%d</strong> registered participants.</p><p><a href=\"%s\">View Participants</a></p><p>- The Astrea Team</p>",
			event.RecipientName, event.EventTitle, event.Count, event.ActionURL)

	case TriggerOrganizerJudgingDeadlineApproaching:
		subject = fmt.Sprintf("Reminder: Judging Deadline Approaching for %s", event.EventTitle)
		textBody = fmt.Sprintf("Hi %s,\n\nThe judging deadline (%s) for %s is approaching. Please ensure judging scores are submitted before the deadline to prevent automatic dispute fallback.\n\nDashboard: %s\n\n- The Astrea Team",
			event.RecipientName, event.Deadline, event.EventTitle, event.ActionURL)
		htmlBody = fmt.Sprintf("<p>Hi %s,</p><p>The judging deadline (<strong>%s</strong>) for <strong>%s</strong> is approaching. Please ensure judging scores are submitted before the deadline to prevent automatic dispute fallback.</p><p><a href=\"%s\">Review Event Status</a></p><p>- The Astrea Team</p>",
			event.RecipientName, event.Deadline, event.EventTitle, event.ActionURL)

	case TriggerJudgeAssigned:
		subject = fmt.Sprintf("Judge Assignment: %s", event.EventTitle)
		textBody = fmt.Sprintf("Hi %s,\n\nYou have been designated as a judge for %s.\n\nJudging Portal: %s\n\n- The Astrea Team",
			event.RecipientName, event.EventTitle, event.ActionURL)
		htmlBody = fmt.Sprintf("<p>Hi %s,</p><p>You have been designated as a judge for <strong>%s</strong>.</p><p><a href=\"%s\">Open Judging Portal</a></p><p>- The Astrea Team</p>",
			event.RecipientName, event.EventTitle, event.ActionURL)

	case TriggerResolverActionNeeded:
		subject = fmt.Sprintf("URGENT: Resolver Action Needed for %s", event.EventTitle)
		textBody = fmt.Sprintf("Hi %s,\n\nA dispute has been triggered on %s (Reason: %s). Your review and resolution signing are required.\n\nResolver Console: %s\n\n- The Astrea Team",
			event.RecipientName, event.EventTitle, event.Reason, event.ActionURL)
		htmlBody = fmt.Sprintf("<p>Hi %s,</p><p><strong style=\"color:red;\">URGENT:</strong> A dispute has been triggered on <strong>%s</strong> (Reason: %s). Your review and resolution signing are required.</p><p><a href=\"%s\">Open Resolver Console</a></p><p>- The Astrea Team</p>",
			event.RecipientName, event.EventTitle, event.Reason, event.ActionURL)

	default:
		subject = fmt.Sprintf("Astrea Update: %s", event.EventTitle)
		textBody = fmt.Sprintf("Hello,\n\nThere is a new update regarding %s.\n\nLink: %s\n\n- The Astrea Team",
			event.EventTitle, event.ActionURL)
		htmlBody = fmt.Sprintf("<p>Hello,</p><p>There is a new update regarding <strong>%s</strong>.</p><p><a href=\"%s\">View Details</a></p><p>- The Astrea Team</p>",
			event.EventTitle, event.ActionURL)
	}

	return subject, textBody, htmlBody
}
