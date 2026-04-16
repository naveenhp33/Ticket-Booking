import { useNavigate } from 'react-router-dom';
import SLACountdown from './SLACountdown';
import { timeAgo, CATEGORY_ICONS, STATUS_LABELS, getInitials, getAvatarColor } from '../../utils/helpers';

/**
 * TicketCard — reusable ticket card component used in lists
 */
export default function TicketCard({ ticket, compact = false }) {
  const navigate = useNavigate();

  const resolved = ['resolved', 'closed'].includes(ticket.status);

  return (
    <div
      className={`ticket-card ticket-card--${ticket.priority}`}
      onClick={() => navigate(`/tickets/${ticket._id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/tickets/${ticket._id}`)}
    >
      {/* Top row */}
      <div className="ticket-card__top">
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div className="ticket-card__id">{ticket.ticketId}</div>
          <div className="ticket-card__title">{ticket.title}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span className={`badge badge--${ticket.status}`}>
            <span className="badge__dot" />
            {STATUS_LABELS[ticket.status] || ticket.status}
          </span>
          <span className={`badge badge--${ticket.priority}`}>{ticket.priority}</span>
        </div>
      </div>

      {/* Description (hidden in compact mode) */}
      {!compact && (
        <div className="ticket-card__desc">{ticket.description}</div>
      )}

      {/* Meta */}
      <div className="ticket-card__meta">
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {CATEGORY_ICONS[ticket.category]} {ticket.category}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          🕐 {timeAgo(ticket.createdAt)}
        </span>
        {ticket.priorityScore > 0 && (
          <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', background: 'var(--color-bg)', padding: '1px 6px', borderRadius: 'var(--radius-full)' }}>
            Score: {ticket.priorityScore}
          </span>
        )}
        {ticket.reopenCount > 0 && (
          <span className="badge badge--reopened">🔁 ×{ticket.reopenCount}</span>
        )}
        {ticket.emailSource && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>📧 via email</span>
        )}
      </div>

      {/* Footer */}
      <div className="ticket-card__footer">
        <div className="ticket-card__assignee">
          {ticket.assignedTo ? (
            <>
              <div
                className="avatar avatar--xs"
                style={{ background: getAvatarColor(ticket.assignedTo.name) }}
              >
                {getInitials(ticket.assignedTo.name)}
              </div>
              <span>{ticket.assignedTo.name}</span>
            </>
          ) : (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              Unassigned
            </span>
          )}
        </div>

        {/* SLA live countdown */}
        {ticket.sla?.deadline && (
          <SLACountdown
            deadline={ticket.sla.deadline}
            breached={ticket.sla.breached}
            resolved={resolved}
            size="sm"
          />
        )}
      </div>
    </div>
  );
}
