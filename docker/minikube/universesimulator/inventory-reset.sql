-- Empties, in minikube's `inventory`, what `universesimulator` put there, before
-- `make reset-simulation` imports its world again: the warehouses' goods (credited once by the
-- import, which remembers it in its own database, emptied too) and the holds of supply orders.
-- POIs and every other holder (players, corporations, system) are left as they are.
delete from inventory_holds where holder_type = 'warehouse' or ref_type = 'supply_order';
delete from inventory_instances where holder_type = 'warehouse';
delete from inventory_stacks where holder_type = 'warehouse';
