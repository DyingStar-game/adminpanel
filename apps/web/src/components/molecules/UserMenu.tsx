import { ChevronDownIcon, LogOutIcon, UserIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface UserMenuProps {
  username: string;
  name: string | null;
  roles: string[];
  onSignOut: () => void;
  labels: { account: string; signedInAs: string; roles: string; noRoles: string; signOut: string };
}

/** The signed-in user in the top bar: who, which roles, sign out (ADR 0023). */
export function UserMenu({ username, name, roles, onSignOut, labels }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={labels.account}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-fg-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <UserIcon className="size-3.5" aria-hidden />
        <span className="max-w-40 truncate">{username}</span>
        <ChevronDownIcon className="size-3.5 text-fg-3" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-xs font-normal text-fg-3">{labels.signedInAs}</span>
          <span className="truncate">{name ?? username}</span>
          {name && <span className="truncate text-xs font-normal text-fg-3">{username}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="text-xs font-normal text-fg-3">{labels.roles}</span>
          <span className="flex flex-wrap gap-1">
            {roles.length === 0 ? (
              <span className="text-xs font-normal">{labels.noRoles}</span>
            ) : (
              roles.map((role) => (
                <span
                  key={role}
                  className="rounded border px-1.5 py-0.5 font-mono text-2xs font-normal"
                >
                  {role}
                </span>
              ))
            )}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOutIcon aria-hidden />
          {labels.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
