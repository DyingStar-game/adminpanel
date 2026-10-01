import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/explorer', search: { parent: '', scope: 'level', page: 1 } });
  },
});
