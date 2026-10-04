import type { Item } from '@dyingstar-admin/schemas';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useItemActions } from '@/stores/itemActions';
import { DeleteItemDialog } from './DeleteItemDialog';
import { DuplicateDialog } from './DuplicateDialog';
import { ItemCreateSheet } from './ItemCreateSheet';
import { ItemEditSheet } from './ItemEditSheet';

interface ItemActionsHostProps {
  onCreated: (item: Item) => void;
  onDeleted: (item: Item) => void;
}

/** Shows the write action requested through `useItemActions` (one at a time, app-wide). */
export function ItemActionsHost({ onCreated, onDeleted }: ItemActionsHostProps) {
  const { action, close } = useItemActions();
  const sheetOpen = action?.kind === 'edit' || action?.kind === 'create';

  return (
    <>
      <Sheet open={sheetOpen} onOpenChange={(open) => !open && close()}>
        <SheetContent className="flex flex-col gap-0 p-0 data-[side=right]:w-[min(720px,100vw)] data-[side=right]:sm:max-w-180">
          {action?.kind === 'edit' && (
            <ItemEditSheet key={action.uuid} uuid={action.uuid} onDone={close} />
          )}
          {action?.kind === 'create' && (
            <ItemCreateSheet
              parentId={action.parentId}
              objectType={action.objectType}
              spawn={action.spawn}
              place={action.place}
              onCancel={close}
              onCreated={(item) => {
                close();
                onCreated(item);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
      {action?.kind === 'duplicate' && (
        <DuplicateDialog
          uuid={action.uuid}
          onCancel={close}
          onDuplicated={(item) => {
            close();
            onCreated(item);
          }}
        />
      )}
      {action?.kind === 'delete' && (
        <DeleteItemDialog
          uuid={action.uuid}
          onCancel={close}
          onDeleted={(item) => {
            close();
            onDeleted(item);
          }}
        />
      )}
    </>
  );
}
