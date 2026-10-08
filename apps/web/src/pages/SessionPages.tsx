import { useTranslation } from 'react-i18next';
import { LogInIcon, LogOutIcon } from 'lucide-react';
import { OptionSelect } from '@/components/molecules/OptionSelect';
import { GateLayout } from '@/components/templates/GateLayout';
import { Button } from '@/components/ui/button';
import { signInUrl, signOut } from '@/hooks/useSession';
import { LOCALES, type Locale } from '@/i18n';
import { usePreferences } from '@/stores/preferences';

function LanguageChoice() {
  const { t } = useTranslation();
  const { locale, setLocale } = usePreferences();
  return (
    <OptionSelect<Locale>
      label={t('language.label')}
      value={locale}
      options={LOCALES.map((l) => ({ value: l, label: l === 'en' ? 'English' : 'Français' }))}
      onChange={setLocale}
      className="w-26"
    />
  );
}

/** Why the browser came back from Keycloak without a session (`?signin=` set by the BFF). */
const signInNotice = (search: string) => {
  const reason = new URLSearchParams(search).get('signin');
  return reason === 'failed' || reason === 'expired' ? reason : null;
};

/** Shown while signed out: the button leaves for Keycloak's login page. */
export function SignInPage() {
  const { t } = useTranslation();
  const notice = signInNotice(window.location.search);
  // Coming back from a failed sign-in (always on `/`), the notice is not kept.
  const returnTo = notice ? '/' : undefined;
  return (
    <GateLayout aside={<LanguageChoice />} title={t('session.title')}>
      <p className="text-sm text-fg-2">{t('session.signInLead')}</p>
      {notice && (
        <p role="alert" className="rounded-md border border-destructive/40 px-3 py-2 text-sm">
          {t(notice === 'failed' ? 'session.signInFailed' : 'session.signInExpired')}
        </p>
      )}
      <Button asChild>
        <a href={signInUrl(returnTo)}>
          <LogInIcon aria-hidden />
          {t('session.signIn')}
        </a>
      </Button>
    </GateLayout>
  );
}

/** Signed in, but no role of the account opens the panel. */
export function AccessDeniedPage({ username }: { username: string }) {
  const { t } = useTranslation();
  return (
    <GateLayout aside={<LanguageChoice />} title={t('session.deniedTitle')}>
      <p className="text-sm text-fg-2">{t('session.deniedLead', { username })}</p>
      <p className="text-sm text-fg-3">{t('session.deniedHint')}</p>
      <Button variant="outline" onClick={() => void signOut()}>
        <LogOutIcon aria-hidden />
        {t('session.signOut')}
      </Button>
    </GateLayout>
  );
}

/** The BFF does not answer (down, or Keycloak unreachable). */
export function SessionUnavailablePage({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <GateLayout aside={<LanguageChoice />} title={t('session.title')}>
      <p role="alert" className="text-sm text-fg-2">
        {t('session.unavailable')}
      </p>
      <Button variant="outline" onClick={onRetry}>
        {t('session.retry')}
      </Button>
    </GateLayout>
  );
}
