import __PackageName__View from './__package-name__-view';
import { CompositeDisposable, Panel } from 'atom';

// TODO: Edit to describe your package's serialized state
export type SerializedState = {
  __packageName__ViewState: unknown
}

export default {

  __packageName__View: null,
  modalPanel: null,
  subscriptions: null,

  activate(state: SerializedState) {
    this.__packageName__View = new __PackageName__View(state.__packageName__ViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.__packageName__View.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      '__package-name__:toggle': () => this.toggle()
    }));
  },

  deactivate() {
    this.modalPanel?.destroy();
    this.subscriptions?.dispose();
    this.__packageName__View?.destroy();
  },

  serialize(): SerializedState {
    return {
      __packageName__ViewState: this.__packageName__View?.serialize() ?? null
    };
  },

  toggle() {
    console.log('__PackageName__ was toggled!');
    if (!this.modalPanel) return;
    return (
      this.modalPanel.isVisible() ?
      this.modalPanel.hide() :
      this.modalPanel.show()
    );
  }

} satisfies {
  __packageName__View: __PackageName__View | null;
  modalPanel: Panel<unknown> | null;
  subscriptions: CompositeDisposable | null;
  toggle(): void;
  activate(state: SerializedState): void;
  deactivate(): void;
  serialize?(): SerializedState;
};
