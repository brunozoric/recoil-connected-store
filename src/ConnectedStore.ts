import {
	atom,
	AtomOptions,
	ReadWriteSelectorOptions,
	RecoilState,
	selector,
	SetterOrUpdater,
    useRecoilValue,
	useSetRecoilState
} from "recoil";
import { useBatching, useRedo, useUndo } from "recoil-undo";


/**
 * Store that contains all atoms and selectors created by using connectedSelector and connectedAtom
 * This is a global store, so currently it will not work with multiple RecoilRoots.
 * The only thing that needs to be done in order for the Store to become intialized is a component within a RecoilRoot
 * that calls updateInContext and passes itself as the context.
 * @see RecoilRootWithStore
 */
type ConnectedStoreType = {
    setter: SetterOrUpdater<any> | null;
    value: any;
    state: RecoilState<any>;
};
type HelpersType = "startBatch" | "endBatch" | "undo" | "redo";

class ConnectedStore {
    private readonly _store: Map<string, ConnectedStoreType> = new Map();
    private readonly _helpers: Map<HelpersType, () => void> = new Map();
    
    public addRecoilState<T>(state: RecoilState<T>): RecoilState<T> {
        this._store.set(state.key, {
            state: state,
            setter: null,
            value: null
        });
        return state;
    }
    
    public updateRecoilState<T>(a: RecoilState<T>, newVal: T) {
        const cs = this._store.get(a.key);
        if (!cs) {
            throw new Error(
                "Attempting to update a connected value that was not created via connectedAtom."
            );
        }
        if (!cs.setter) {
            throw new Error(
                "Attempting to update a connected value, that has no setter attached yet. Using RecoilRootWithStore?"
            );
        }
        cs.setter(newVal);
    }
    
    public getRecoilState<T>(state: RecoilState<T>): T {
        const cs = this._store.get(state.key);
        if (!cs) {
            throw new Error(
                "Attempting to get a connected value that was not created via connectedAtom."
            );
        }
        if (!cs.value) {
            throw new Error(
                "Attempting to get a connected value, that has no value attached yet. Using RecoilRootWithStore?"
            );
        }
        return cs.value;
    }
    
    public updateInContext(context: any): void {
        const batching = useBatching;
        const setHook = useSetRecoilState;
        const getHook = useRecoilValue;
        const update = (store: ConnectedStoreType) => {
            store.setter = setHook(store.state);
        };
        const value = function(store: ConnectedStoreType) {
            store.value = getHook(store.state);
        };
        
        for (const store of this.getStoreValues()) {
            update.apply(context, [store]);
            value.apply(context, [store]);
        }
        
        this._helpers.clear();
        const { startBatch, endBatch } = batching.apply(context);
        this._helpers.set("startBatch", startBatch);
        this._helpers.set("endBatch", endBatch);
        this._helpers.set("undo", useUndo.apply(context));
        this._helpers.set("redo", useRedo.apply(context));
    }
    
    public startBatch(): void {
        this._helpers.get("startBatch");
    }
    
    public endBatch(): void {
        this._helpers.get("endBatch");
    }
    
    public undo(): void {
        this._helpers.get("undo");
    }
    
    public redo(): void {
        this._helpers.get("redo");
    }
    
    private getStoreValues(): ConnectedStoreType[] {
        return Array.from(this._store.values());
    }
}

export const connectedStore:ConnectedStore = new ConnectedStore();

/**
 * Central function for updating a ConnectedState Atom or Selector
 * @param state An atom or selector created via connectedAtom or connectedSelector
 * @param val The new value of the state.
 * @see connectedAtom
 * @see connectedSelector
 */
export function updateConnectedValue<T>(state:RecoilState<T>,val:T){
	connectedStore.updateRecoilState(state,val);
}

/**
 * Function to create ConnectedState Atoms instead of normal Recoil Atoms.
 * This makes an atom acessible from outside the react component tree.
 * use updateConnectedValue to access this funcitonality.
 * @param options
 * @see atom
 */
export function connectedAtom<T>(options: AtomOptions<T>): RecoilState<T>{
	return connectedStore.addRecoilState(atom<T>(options)); //store the atom for future reference
}
/**
 * Function to create ConnectedState Selectors instead of normal Recoil Selectors.
 * This makes a Selector acessible from outside the react component tree.
 * use updateConnectedValue to access this funcitonality in the cases where you need to update a selector
 * @param options
 * @see selector
 */
export function connectedSelector<T>(options: ReadWriteSelectorOptions<T>): RecoilState<T>{
	return connectedStore.addRecoilState(selector<T>(options) as RecoilState<T>); //store the atom for future reference
}

export const connectedAtomValue = <T>(state: RecoilState<T>): T => {
    return connectedStore.getRecoilState<T>(state);
}

export const connectedBatchStart = (): void => {
    connectedStore.startBatch();
}

export const connectedBatchEnd = (): void => {
    connectedStore.endBatch();
}

export const connectedUndo = (): void => {
    connectedStore.undo();
}

export const connectedRedo = (): void => {
    connectedStore.redo();
}