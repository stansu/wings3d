/*
 *
 * MADS (Modify, Add, Delete, Select) operation. only toggling function
 *
**/

import {Madsor, ToggleModeCommand} from './wings3d_mads';
import {FaceMadsor} from './wings3d_facemads';
import {EdgeMadsor} from './wings3d_edgemads';
import {VertexMadsor} from './wings3d_vertexmads';
import {PreviewCage} from './wings3d_model';
import * as ShaderProg from './wings3d_shaderprog';
import * as View from './wings3d_view';


class MultiMadsor extends Madsor {
   constructor() {
      super('Multi');
   }

   isFaceSelectable() { return true; }
   isEdgeSelectable() { return true; }
   isVertexSelectable() { return true; }

   toggleMulti(hilite) {
      if (hilite.face) {
         View.toggleFaceMode();
      } else if (hilite.vertex) {
         View.toggleVertexMode();
      } else {    // if (hilite.edge) {   
         View.toggleEdgeMode();
      } // not body possible.
   }

   toggleFunc(toMadsor) {
      let redoFn;
      let snapshots;
      if (toMadsor instanceof FaceMadsor) {
         redoFn = View.restoreFaceMode;
         snapshots = this.snapshotAll(PreviewCage.prototype.changeFromMultiToFaceSelect);
      } else if (toMadsor instanceof VertexMadsor) {
         redoFn = View.restoreVertexMode;
         snapshots = this.snapshotAll(PreviewCage.prototype.changeFromMultiToVertexSelect);
      } else if (toMadsor instanceof EdgeMadsor) {
         redoFn = View.restoreEdgeMode;
         snapshots = this.snapshotAll(PreviewCage.prototype.changeFromMultiToEdgeSelect);
      } else { // bodyMadsor
         redoFn = View.restoreEdgeMode;
         snapshots = this.snapshotAll(PreviewCage.prototype.changeFromMultiToBodySelect);
      }
      View.undoQueue(new ToggleModeCommand(redoFn, View.restoreMultiMode, snapshots));
   }

   restoreMode(toMadsor, snapshots) {
      if (toMadsor instanceof FaceMadsor) {
         this.doAll(snapshots, PreviewCage.prototype.restoreFromMultiToFaceSelect);
      } else if (toMadsor instanceof VertexMadsor) {
         this.doAll(snapshots, PreviewCage.prototype.restoreFromMultiToVertexSelect);
      } else if (toMadsor instanceof EdgeVertex) {
         this.doAll(snapshots, PreviewCage.prototype.restoreFromMultiToEdgeSelect);
      } else {
         this.doAll(snapshots, PreviewCage.prototype.restoreFromMultiToBodySelect);      
      }
   }

   drawExtra(_gl, _draftBench) {
      // no hilite
   }
};


export {
   MultiMadsor
}