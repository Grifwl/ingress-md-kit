/**
 * The organisers of a Mission Day: who can open it in this tool, and with
 * which role. Not to be confused with the team written in Settings, which
 * is what the Niantic application lists.
 */
import { useState } from 'preact/hooks';
import type { CurrentUser, Member, MembershipRole } from '../../../shared/types';
import { useI18n } from '../../i18n';
import { addMember, listMembers, removeMember, setMemberRole } from '../api';
import { ConfirmButton, ErrorMessage, Field } from '../components/common';
import { useAsync } from '../hooks';
import { removesLastOwner } from '../lib/members';
import { navigate } from '../router';

const ROLES: readonly MembershipRole[] = ['owner', 'editor'];

/** Properties of the team screen. */
interface TeamPageProps {
  slug: string;
  user: CurrentUser;
  /** Requester's role here; null for an instance administrator outside the team. */
  role: MembershipRole | null;
  members: Member[];
  onChange: (members: Member[]) => void;
  /** Called when the requester's own role changes but they stay on the team. */
  onOwnRoleChange?: (role: MembershipRole) => void;
}

/**
 * Form to add someone to the team.
 *
 * @param props - Mission Day slug and the callback receiving the new team.
 * @returns The form element.
 */
function AddMemberForm({ slug, onAdded }: { slug: string; onAdded: (members: Member[]) => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MembershipRole>('editor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  /**
   * Adds the person and clears the form.
   *
   * @param event - Form submission.
   */
  const submit = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      onAdded(await addMember(slug, email, role));
      setEmail('');
      setRole('editor');
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="card" onSubmit={submit}>
      <h2>{t('team.add')}</h2>
      <p class="muted">{t('team.addHelp')}</p>
      <div class="row-end wrap">
        <Field label={t('team.email')}>
          <input
            type="email"
            required
            value={email}
            onInput={(e) => setEmail(e.currentTarget.value)}
          />
        </Field>
        <Field label={t('team.role')}>
          <select value={role} onChange={(e) => setRole(e.currentTarget.value as MembershipRole)}>
            {ROLES.map((option) => (
              <option key={option} value={option}>
                {t(`role.${option}`)}
              </option>
            ))}
          </select>
        </Field>
        <button class="button primary" disabled={busy}>
          {t('team.addButton')}
        </button>
      </div>
      <ErrorMessage error={error} />
    </form>
  );
}

/**
 * The team screen, for a team already loaded.
 *
 * @param props - See {@link TeamPageProps}.
 * @returns The page content.
 */
export function TeamPage({ slug, user, role, members, onChange, onOwnRoleChange }: TeamPageProps) {
  const { t } = useI18n();
  const [error, setError] = useState<unknown>();
  const canManage = role === 'owner' || user.isInstanceAdmin;

  /**
   * Runs a change and reports what it means for the requester. Leaving the
   * team closes this Mission Day to them, so they go back to the list; an
   * instance administrator instead reloads into the outsider's view of
   * this team, which they can still manage.
   *
   * @param change - The API call.
   */
  const apply = async (change: () => Promise<Member[]>) => {
    setError(undefined);
    try {
      const next = await change();
      const mine = next.find((member) => member.email === user.email);
      if (mine === undefined && role !== null) {
        if (user.isInstanceAdmin) {
          location.reload();
        } else {
          navigate('/admin');
        }
        return;
      }
      onChange(next);
      if (mine !== undefined && mine.role !== role) {
        onOwnRoleChange?.(mine.role);
      }
    } catch (failure) {
      setError(failure);
    }
  };

  return (
    <div class="stack">
      <section class="card">
        <h2>{t('team.title')}</h2>
        <p class="muted">{t('team.help')}</p>
        <ErrorMessage error={error} />
        <table class="data-table">
          <thead>
            <tr>
              <th>{t('team.organiser')}</th>
              <th>{t('team.faction')}</th>
              <th>{t('team.role')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const isMe = member.email === user.email;
              return (
                <tr key={member.email}>
                  <td>
                    <strong>{member.codename === '' ? '—' : member.codename}</strong>
                    {isMe && <span class="badge">{t('team.you')}</span>}
                    <div class="muted small">{member.email}</div>
                  </td>
                  <td>{member.faction ?? '—'}</td>
                  <td>
                    {canManage ? (
                      <select
                        aria-label={t('team.role')}
                        value={member.role}
                        onChange={(e) => {
                          const next = e.currentTarget.value as MembershipRole;
                          e.currentTarget.value = member.role;
                          void apply(() => setMemberRole(slug, member.email, next));
                        }}
                      >
                        {ROLES.map((option) => (
                          <option
                            key={option}
                            value={option}
                            disabled={removesLastOwner(members, member.email, option)}
                          >
                            {t(`role.${option}`)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      t(`role.${member.role}`)
                    )}
                  </td>
                  <td class="cell-end">
                    {(canManage || isMe) && (
                      <ConfirmButton
                        disabled={removesLastOwner(members, member.email, null)}
                        label={isMe ? t('team.leave') : t('common.remove')}
                        confirmLabel={isMe ? t('team.confirmLeave') : t('team.confirmRemove')}
                        onConfirm={() => void apply(() => removeMember(slug, member.email))}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {canManage && members.filter((member) => member.role === 'owner').length === 1 && (
          <p class="muted small">{t('team.lastOwnerHelp')}</p>
        )}
      </section>
      {canManage && (
        <AddMemberForm slug={slug} onAdded={(next) => void apply(() => Promise.resolve(next))} />
      )}
    </div>
  );
}

/**
 * The team screen for an instance administrator who is not on the team,
 * and therefore cannot open the rest of the Mission Day. It loads the team
 * by itself, since the usual Mission Day data is out of reach.
 *
 * @param props - Mission Day slug and the signed-in administrator.
 * @returns The page element.
 */
export function OutsiderTeamPage({ slug, user }: { slug: string; user: CurrentUser }) {
  const { t } = useI18n();
  const members = useAsync(() => listMembers(slug), [slug]);

  return (
    <>
      <p class="success">{t('team.outsider')}</p>
      <ErrorMessage error={members.error} />
      {members.loading && <p>{t('app.loading')}</p>}
      {members.data !== undefined && (
        <TeamPage
          slug={slug}
          user={user}
          role={null}
          members={members.data}
          onChange={(next) => {
            // Once they have added themself, the whole Mission Day opens up.
            if (next.some((member) => member.email === user.email)) {
              location.reload();
            } else {
              members.setData(next);
            }
          }}
        />
      )}
    </>
  );
}
