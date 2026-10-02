import type { Item } from '@dyingstar-admin/schemas';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useItemActions } from '@/stores/itemActions';
import { DeleteItemDialog } from './DeleteItemDialog';
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
        <SheetContent className="flex w-[520px] flex-col gap-0 p-0 sm:max-w-[520px]">
          {action?.kind === 'edit' && (
            <ItemEditSheet key={action.uuid} uuid={action.uuid} onDone={close} />
          )}
          {action?.kind === 'create' && (
            <ItemCreateSheet
              parentId={action.parentId}
              objectType={action.objectType}
              onCancel={close}
              onCreated={(item) => {
                close();
                onCreated(item);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
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
