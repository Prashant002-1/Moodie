import { Link } from 'react-router-dom';
import { personHue } from '../../utils/person';

/** A person's initial on their colour. Links to their profile unless `to` is null. */
export function Avatar({ username, size, to, className = '' }: {
  username: string; size?: 'sm' | 'lg' | 'xl'; to?: string | null; className?: string;
}) {
  const classes = `avatar${size ? ` avatar--${size}` : ''}${className ? ` ${className}` : ''}`;
  const hue = personHue(username);
  if (to === null) return <span aria-hidden="true" className={classes} data-hue={hue}>{username.charAt(0)}</span>;
  return <Link aria-label={`Open @${username}'s profile`} className={classes} data-hue={hue} to={to ?? `/member/${username}`}>{username.charAt(0)}</Link>;
}
