/*
//     This module implements most of the commands in the View menu. 
//
// Original Erlang Version: Bjorn Gustavsson
*/

import * as UI from './wings3d_ui';
import * as Renderer from './wings3d_render';
import * as Camera from './wings3d_camera';
import {gl} from './wings3d_gl';
import { WavefrontObjImportExporter } from './plugins/wavefront_obj';
import * as Wings3D from './wings3d';
import {EditCommandSimple, EditCommandCombo} from './wings3d_undo';
import {FaceMadsor} from './wings3d_facemads';
import {EdgeMadsor} from './wings3d_edgemads';
import {VertexMadsor} from './wings3d_vertexmads';
import {BodyMadsor} from './wings3d_bodymads';
import {PreviewCage} from './wings3d_model';
import {DraftBench, CheckPoint} from './wings3d_draftbench';


// 
// pref and theme
//
// init Prop
const prop = {
      showEdges: true,
      showBackfaces: true,
      showNormals: false,
      showBB: true,
      showBBCenter: true,
      showColors: true,
      showMaterials: true,
      showTextures: true,
      showNormalMaps: true,
      showWireBackfaces: false,
      showGroundplane: true,
      showCamImagePlane: false,
      showAxes: true,
      constrainAxes: true,
      clipPlane: false,
      orthogonalView: false,
      numberOfLights: 1,
      activeShader: 1,
      filterTexture: true,
      frameDisregardsMirror: false,
      useSceneLights: false,
      forceOrthoAlongAxis: false,
      workmode: true,
      //wireFramedObjects: gb_sets:empty(),
      //currentView: DEFAULT_VIEW,   // goes to camera
      allowRotation: true,
      allowInfoText: true,
      miniAxis: true
   };
const nativeTheme = {
       activeVectorColor: [0.0, 1.0, 0.0],
       clipPlaneColor: [0.8, 0.3, 0.0],
       consoleColor: [1.0, 1.0, 1.0],
       consoleTextColor: [0.0, 0.0, 0.0],
       defaultAxis: [[0.0, 0.0, 0.0], [1.0, 0.0, 0.0]],
       edgeColor: [0.0, 0.0, 0.0],
       gridColor: [0.3, 0.3, 0.3],
       hardEdgeColor: [1.0, 0.5, 0.0],
       infoBackgroundColor: [0.38, 0.38, 0.38, 0.5],
       infoColor: [1.0, 1.0, 1.0],
       infoLineBg: [0.33131360000000004, 0.4, 0.0],
       infoLineText: [1.0, 1.0, 1.0],
       maskedVertexColor: [0.5, 1.0, 0.0, 0.8],
       materialDefault: [0.7898538076923077, 0.8133333333333334, 0.6940444444444445],
       normalVectorColor: [0.0, 1.0, 0.0],
       sculptMagnetColor: [0.0, 0.0, 1.0, 0.1],
       selectedColor: [0.65, 0.0, 0.0],
       selectedHlite: [0.7, 0.7, 0.0],
       tweakMagnetColor: [0.0, 0.0, 1.0, 0.06],
       tweakVectorColor: [1.0, 0.5, 0.0],
       unselectedHlite: [0.0, 0.65, 0.0],
       vertexColor: [0.0, 0.0, 0.0],
       color: [[0.7, 0.0, 0.1], [0.37210077142857145, 0.82, 0.0], [0.0, 0.3, 0.8]],
       negColor: [[0.8, 0.8, 0.8], [0.8, 0.8, 0.8], [0.8, 0.8, 0.8]]
   };
let theme = nativeTheme;

//--  end of pref and theme --------------------------------------------------------------------------

// 
// editing mode management
//
const mode = {             // private variable, needed to initialize after gl, 
   face: null,//new FaceMadsor, 
   edge: null,//new EdgeMadsor,
   vertex: null,//new VertexMadsor,
   body: null,//new BodyMadsor,
   current: null,
};
function initMode() {
   mode.face = new FaceMadsor;
   mode.edge = new EdgeMadsor;
   mode.vertex = new VertexMadsor;
   mode.body = new BodyMadsor;
   mode.current = mode.face;
};


function toggleMode(mode) {
   let button = document.getElementById('toggle'+mode+'Mode');  // :checked property only existed on <input>
   if (button && !button.checked) {
      button.click();         // https://stackoverflow.com/questions/8206565/check-uncheck-checkbox-with-javascript
   }
}
function toggleVertexMode() {
   // change current mode to 
   if (mode.current !== mode.vertex) {
      mode.current.toggleFunc(mode.vertex);
      mode.current = mode.vertex;
      toggleMode('Vertex');
      Renderer.needToRedraw();
   }
};

function toggleFaceMode() {
   if (mode.current !== mode.face) {
      mode.current.toggleFunc(mode.face);
      mode.current = mode.face;
      toggleMode('Face');
      Renderer.needToRedraw();
   }
};

function toggleEdgeMode() {
   if (mode.current !== mode.edge) {
      mode.current.toggleFunc(mode.edge);
      mode.current = mode.edge;
      toggleMode('Edge');
      Renderer.needToRedraw();
   }
};

function toggleBodyMode() {
   if (mode.current !== mode.body) {
      mode.current.toggleFunc(mode.body);
      mode.current = mode.body;
      toggleMode('Body');
      Renderer.needToRedraw();
   }
};

function restoreVertexMode(snapshots) {
   if (mode.current !== mode.vertex) {
      mode.current.restoreMode(mode.vertex, snapshots);
      mode.current = mode.vertex;
      toggleMode('Vertex');
      Renderer.needToRedraw();
   } else {
      // bad state. should always be in other mode. 
   }
};

function restoreFaceMode(snapshots) {
   if (mode.current !== mode.face) {
      mode.current.restoreMode(mode.face, snapshots);
      mode.current = mode.face;
      toggleMode('Face');
      Renderer.needToRedraw();
   } else {
      // bad state. should always be in other mode. 
   }
};

function restoreEdgeMode(snapshots) {
   if (mode.current !== mode.edge) {
      mode.current.restoreMode(mode.edge, snapshots);
      mode.current = mode.edge;
      toggleMode('Edge');
      Renderer.needToRedraw();
   } else {
      // bad state. should always be in other mode. 
   }
};

function restoreBodyMode(snapshots) {
   if (mode.current !== mode.body) {
      mode.current.restoreMode(mode.body, snapshots);
      mode.current = mode.body;
      toggleMode('Body');
      Renderer.needToRedraw();
   } else {
      // bad state. should always be in other mode. 
   }
};

const currentMode = () => mode.current;
//- End of editing Mode ----------

//
// world objects management
//
const world = []; // private var
let draftBench; // = new DraftBench; wait for GL
function putIntoWorld() {
   let model = new PreviewCage(draftBench);
   return addToWorld(model);
};

function addToWorld(model) {
   world.push( model );
   model.show();
   draftBench.updatePreview();
   Renderer.needToRedraw();
   return model;
}

function removeFromWorld(previewCage) {
   var index = world.indexOf(previewCage);
   if (index >= 0) {
      world.splice(index, 1);
      previewCage.hide();
      draftBench.updatePreview();
      Renderer.needToRedraw();
   }
};
function getWorld() {
   return world;
}
function updateWorld() {
   draftBench.updatePreview();
   Renderer.needToRedraw();
};
function makeCombineIntoWorld(cageSelection) {
   let combine = new PreviewCage(draftBench);
   for (let cage of cageSelection) {
      removeFromWorld(cage);
   }
   combine.merge(cageSelection);
   addToWorld(combine);
   return combine;
}
//-- End of World objects management ----------------dra---------

const isVertexSelectable = () => mode.current ? mode.current.isVertexSelectable() : true;
const isEdgeSelectable = () => mode.current ? mode.current.isEdgeSelectable() : true;
const isFaceSelectable = () => mode.current ? mode.current.isFaceSelectable() : true;
//
// hilite
//
const hilite = {cage: null, edge: null, vertex: null, face: null};
let currentCage;
function setCurrent(edge, intersect, center) {
   // find out origin, dest. which is closer.
   let hiliteVertex = null, hiliteEdge = null, hiliteFace = null, hiliteCage = null;
   if (edge !== null) {
      const a = vec3.create(), b = vec3.create(), c = vec3.create();
      const destination = edge.destination().vertex; // find out if we are within the distance threshold
      const origin = edge.origin.vertex;
      vec3.sub(a, intersect, origin);
      vec3.sub(b, intersect, destination);
      vec3.sub(c, destination, origin);
      const dist0 = vec3.length(a);
      const dist1 = vec3.length(b);
      const dist2 = vec3.length(c);
      const threshold = dist2 / 4.0;
      const isVertex = isVertexSelectable();
      const isEdge = isEdgeSelectable();
      const isFace = isFaceSelectable();
      if (isVertex) {
         if (dist0 < dist1) {
            if (!(isEdge || isFace) || (dist0 < threshold)) {  // only multiple selectable needs to check threshold
               hiliteVertex = edge.origin;
            }
         } else {
            if (!(isEdge || isFace) || (dist1 < threshold)) {
               hiliteVertex = edge.destination();
            }
         }
      }
      if (isEdge && (hiliteVertex === null)) { // check out if edge is close enough
         vec3.cross(a, a, b);
         vec3.sub(b, destination, origin);
         const distance = vec3.length(a) / dist2;
         if (!(isVertex || isFace) || (distance < threshold)) {
            hiliteEdge = edge;
         }
      }
      if (isFace && (hiliteEdge === null)) {   // now hilite face
         hiliteFace = edge.face;
      }
      if (!(isVertex || isEdge || isFace)) {    // all 3 mode not true then only bodyMode possible.
         hiliteCage = currentCage;
      }
   }
   // now do hilite.
   if (hiliteVertex !== hilite.vertex) {  
      if (hilite.vertex !== null) {
         draftBench.hiliteVertex(hilite.vertex, false);
      }
      if (hiliteVertex !== null) {
         draftBench.hiliteVertex(hiliteVertex, true);
      }
      hilite.vertex = hiliteVertex;
   }
   if (hiliteEdge !== hilite.edge) {
      if (hilite.edge !== null) {
         draftBench.hiliteEdge(hilite.edge, false);
      }
      if (hiliteEdge !== null) {
         draftBench.hiliteEdge(hiliteEdge, true);
      }
      hilite.edge = hiliteEdge;
   }
   if (hiliteFace !== hilite.face) {
      if (hilite.face !== null) {
         draftBench.hiliteFace(hilite.face, false); // hiliteFace(null, false)?
      }
      if (hiliteFace !== null) {
         draftBench.hiliteFace(hiliteFace, true);
      }
      hilite.face = hiliteFace;
   }
   if (hiliteCage !== hilite.cage) {
      if (hilite.cage !== null) {
         hilite.cage.hiliteBody(false);
      }
      if (hiliteCage) {
         hiliteCage.hiliteBody(true);
      }
      hilite.cage = hiliteCage;
   }
}


//
// mouse handling
//
let lastPick = null;

function rayPick(ray) {
   let pick = null;
   for (let model of world) {
      const newPick = model.rayPick(ray);
      if (newPick !== null) {
         if ((pick === null) || (pick.t > newPick.t)) {
            pick = newPick;
         }
      }
   }
   if (pick !== null) {
      currentCage = pick.model;
      //if (lastPick !== null && lastPick.model !== pick.model) {
      //   lastPick.model.setCurrentSelect(null);
      //}
      // now set current edge again.
      lastPick = pick;
      let intersect = vec3.create();
      vec3.scaleAndAdd(intersect, ray.origin, ray.direction, pick.t);
      setCurrent(pick.edge, intersect, pick.center);
      Renderer.needToRedraw();
   } else {
      if (lastPick !== null) {
         // deselect last selection
         setCurrent(null);
         Renderer.needToRedraw();
      }
   }
   // now the currentPick will be the next lastPick.
   lastPick = pick;
};

let dragMode = null;
function selectStart() {
   if (lastPick !== null) {
      dragMode = mode.current.selectStart(lastPick.model, hilite);
      Renderer.needToRedraw();
   }
};

function selectDrag() {
   if ((dragMode !== null)) {// &&
       if ((lastPick !== null)) {
         dragMode.dragSelect(lastPick.model, hilite);
         Renderer.needToRedraw();
      }
   }
}

function selectFinish() {
   if (dragMode !== null) {
      undoQueue(dragMode.finish());
      dragMode = null;
   }
}

const handler = {camera: null, mousemove: null, mouseSelect: null};
function canvasHandleMouseDown(ev) {
   if (ev.button == 0) {
      if (handler.camera !== null) {
         handler.camera.doIt();  
         handler.camera = null;
         Wings3D.log(Wings3D.action.cameraModeExit, Camera.view);
         help('L:Select   M:Start Camera   R:Show Menu   [Alt]+R:Tweak menu');      
      } else if (handler.mousemove !== null) {
         undoQueue( handler.mousemove );  // put on queue, commit()?
         handler.mousemove = null;
      } else if (handler.mouseSelect !== null) {
         if (handler.mouseSelect.select(hilite)) {
            handler.mouseSelect.doIt();
            undoQueue( handler.mouseSelect );
            handler.mouseSelect = null;
         }
      } else {
         //e.stopImmediatePropagation();
         // ask view to select current hilite if any.
         selectStart();
      }
   }
};

function canvasHandleMouseEnter(ev) {
   if (handler.camera !== null) {
      help('L:Accept   M:Drag to Pan  R:Cancel/Restore to View   Move mouse to tumble');
   } else {
      help('L:Select   M:Start Camera   R:Show Menu   [Alt]+R:Tweak menu');
   }
};

function canvasHandleMouseLeave(ev) {
   selectFinish();       // we can't caputre mouseup when mouse leave, so force to finish the selection.
};

// event handling, switching state if needs to be
function canvasHandleMouseUp(ev) {
   if (ev.button == 0) {
      selectFinish();
   } else if (ev.button == 1) { // check for middle button down
      if (handler.camera === null) {
         ev.stopImmediatePropagation();
         // let camera handle the mouse event until it quit.
         handler.camera = Camera.getMouseMoveHandler();
         // tell tutor step, we are in camera mode
         Wings3D.log(Wings3D.action.cameraModeEnter, Camera.view);
         help('L:Accept   M:Drag to Pan  R:Cancel/Restore to View   Move mouse to tumble');
         // disable mouse cursor
         //document.body.style.cursor = 'none';
      } 
   }
};

function canvasHandleMouseMove(e) {
   if (handler.camera !== null) {
      handler.camera.handleMouseMove(e);
   } else if (handler.mousemove !== null) {
      handler.mousemove.handleMouseMove(e, Camera.view);
      Renderer.needToRedraw();
   } else {
      // handle pick selection
      var viewport = gl.getViewport();
      var winx = e.pageX - e.currentTarget.offsetLeft;
      var winy = (viewport[3]+1) - (e.pageY - e.currentTarget.offsetTop);   // y is upside-down
      // yes, sometimes mouse coordinate is outside of the viewport. firefox is larger than width, height.
      if (winx < 0) { winx = 0; }
      if (winx > viewport[2]) { winx = viewport[2];}
      if (winy < 0) { winy = 0; }
      if (winy > viewport[3]) { winy = viewport[3];}

      var mat = loadMatrices(false);
      var ptNear = gl.unProject(winx, winy, 0.0, mat.modelView, mat.projection);
      var ptFar = gl.unProject(winx, winy, 1.0, mat.modelView, mat.projection);

      vec3.sub(ptFar, ptFar, ptNear);
      vec3.normalize(ptFar, ptFar);
      var ray = {origin: ptNear, direction: ptFar};
      //geometryStatus("mouse position: " + ptNear[0] + ", " + ptNear[1] + "," + ptNear[2] + ", <br />"+ ptFar[0] + ", " + ptFar[1] + ", " + ptFar[2]);
      rayPick(ray);
      // selectDrag if left button mousedown
      selectDrag();
   }
};

// contextMenu, mouse right click.
function canvasHandleContextMenu(ev) {
   if (handler.camera || handler.mousemove || handler.mouseSelect) {
      // prevent propagation.
      ev.preventDefault();
      ev.stopImmediatePropagation();      // prevent document's contextmenu popup
      if (handler.camera) {
         handler.camera.undo();
         handler.camera = null;
         Wings3D.log(Wings3D.action.cameraModeExit, Camera.view);   // log action
         help('L:Select   M:Start Camera   R:Show Menu   [Alt]+R:Tweak menu');
      } else if (handler.mousemove) {
         handler.mousemove.undo();
         handler.mousemove = null;
         Renderer.needToRedraw();
      } else {
         handler.mouseSelect = null;   // no needs to undo because we havent doIt() yet.
         Renderer.needToRedraw();
      }
      return true;
   }
   // let wings3d_contextmenu handle the event.
   return false;
};

// handling in reverse order. the newest one will handle the event. (should be at most 2 handler)
function attachHandlerMouseMove(mousemoveHandler) {
   // should we make sure handler.mousemove is null?
   handler.mousemove = mousemoveHandler;
};
function attachHandlerMouseSelect(mouseSelectHandler) {
   handler.mouseSelect = mouseSelectHandler;
};

function canvasHandleWheel(e) {
   // adjusting to scroll pixels, inspiration from facebook's estimate.
   var px = e.deltaX, py = e.deltaY, pz = e.deltaZ;
   if ((px || py || pz) && e.deltaMode) {
      var scale = 360;        // page scaler
      if (e.deltaMode == 1) {
         scale = 18;          // line scaler, should be line height
      }
      px *= scale;
      py *= scale;
      pz *= scale;
   }
   
   // asks camera to zoomIn/Out.
   Camera.zoomStep(py);
};

//-- end of mouse handling-----------------------------------------------

// 
// undo/redo handling
//
const undo = {queue: [], current: -1};
// undo queueCombo, convenient functions
function undoQueueCombo(editCommands) {
   // wrap the array in a combo
   const combo = new EditCommandCombo(editCommands);
   undoQueue( combo );
};
// undo queue
function undoQueue(editCommand) {
   //if (!editCommand.doIt()) {  // move all check here.
   //   return;
   //}
   // editCommand = new CheckPoint(draftBench, editCommand);      // debug purpose. 

   while ( (undo.queue.length-1) > undo.current ) {
      // remove branch not taken
      const cmd = undo.queue.pop();
      cmd.free();
   }
   // now push the new command back
   undo.queue.push(editCommand);
   undo.current++;
   Renderer.needToRedraw();
};

function redoEdit() {
   if ( (undo.queue.length-1) > undo.current) {
      undo.queue[++undo.current].doIt(mode.current);
      Renderer.needToRedraw();
   }
};

function undoEdit() {
   if (undo.current >= 0) {
      undo.queue[undo.current--].undo(mode.current);
      Renderer.needToRedraw();
   }
};

function doCommand(command) {
   if (command.doIt()) {
      undoQueue(command);
      return true;
   } else {
      // todo: pop messages, said command not workable.
      return false;
   }
}

// -- end of undo/redo handling ----------------------------------------------------------------------------------


//
// world rendering and utility functions
//
function loadMatrices(includeLights) {
   let proj = projection(mat4.create()); // passed identity matrix.
   let tmm = modelView(includeLights);
   return { projection: proj, modelView: tmm.modelView, useSceneLights: tmm.useSceneLights };
};

//projection() ->
//     OP0 = gl:getDoublev(?GL_PROJECTION_MATRIX),
//     projection(e3d_transform:init(list_to_tuple(OP0))).
function projection(In) {
   const size = gl.getViewport();
   const aspect = (size[2]-size[0]) / (size[3]-size[1]);
   const view = Camera.view;
   const ortho = view.orthogonalView;
   if (!ortho && view.alongAxis) {
      ortho = prop.force_ortho_along_axis;
   }
   var tp = mat4.create();
   if (ortho) {
      const sz = view.distance * Math.tan(view.fov * Math.PI  / 180 / 2);
      mat4.ortho(tp, -sz * aspect, sz * aspect, -sz, sz, view.zNear, view.zFar);      
   } else {
      mat4.perspective(tp, view.fov, aspect, view.zNear, view.zFar);
   }

   mat4.mul(gl.projection, In, tp);
   return gl.projection;
};

function modelView(includeLights = false) {
   const view = Camera.view;

   let useSceneLights = false;
   if (includeLights) {
      useSceneLights = prop.useSceneLights; // && Wings3D.light.anyEnabledLights();
      if (!useSceneLights) {
         //Wings3D.light.cameraLights();
      }
   }

   // fromTranslation, identity * vec3. modelView rest.
   mat4.fromTranslation(gl.modelView, vec3.fromValues(view.panX, view.panY, -view.distance));
   mat4.rotateX(gl.modelView, gl.modelView, view.elevation * Math.PI / 180);
   mat4.rotateY(gl.modelView, gl.modelView, view.azimuth * Math.PI / 180);
   mat4.translate(gl.modelView, gl.modelView, view.origin);

   if (useSceneLights) {
      //Wings3D.light.globalLights();
   }
   return {useScentLights: useSceneLights, modelView: gl.modelView};
};

function drawWorld(gl) {
   if (world.length > 0) {
      gl.polygonOffset(1.0, 1.0);          // Set the polygon offset
      gl.enable(gl.POLYGON_OFFSET_FILL);
      mode.current.previewShader(gl);
      //world.forEach(function(model, _index, _array){
         gl.bindTransform();
         draftBench.draw(gl);
      //});
      gl.disableShader();
      gl.disable(gl.POLYGON_OFFSET_FILL);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_COLOR, gl.DST_COLOR);
      // draw Current Select Mode (vertex, edge, or face)
      //if (hilite.vertex || hilite.edge || hilite.face || hilite.cage) {
         mode.current.draw(gl, draftBench);
      //}
      gl.disable(gl.BLEND);
   }
}

function render(gl) {
   Renderer.render(gl, drawWorld);
};

//-- end of world rendering and utility functions ---------------------------------------------------------------

//
// initialization
//
function init() {
   initMode();
   // init menu
   const selectionMenu = [ {id: Wings3D.action.deselect, fn: 'resetSelection', hotKey: ' '},
                         {id: Wings3D.action.more, fn: 'moreSelection', hotKey: '+'},
                         {id: Wings3D.action.less, fn: 'lessSelection', hotKey: '-'},
                         {id: Wings3D.action.similar, fn: 'similarSelection', hotkey: 'i'},
                         {id: Wings3D.action.all, fn: 'allSelection', hotKey: 'a', meta: 'ctrl'}, 
                         {id: Wings3D.action.invert, fn: 'invertSelection', hotKey: 'i', meta: 'ctrl+shift'},
                         {id: Wings3D.action.adjacent, fn: 'adjacentSelection'}
                        ];
   for (let select of selectionMenu) {
      UI.bindMenuItem(select.id.name, function(ev) {
         const command = new EditCommandSimple(select.fn);
         if(command.doIt(mode.current)) {
            undoQueue( command );
            Renderer.needToRedraw();
         }
      }, select.hotKey, select.meta);
   }

   const toolBar = [ {id: Wings3D.action.undoEdit, fn: undoEdit, hotKey: ' '},
                     {id: Wings3D.action.redoEdit, fn: redoEdit, hotKey: ' '},
                     {id: Wings3D.action.toggleVertexMode, fn: toggleVertexMode, hotKey: ' '},
                     {id: Wings3D.action.toggleEdgeMode, fn: toggleEdgeMode, hotKey: ' '},
                     {id: Wings3D.action.toggleFaceMode, fn: toggleFaceMode, hotKey: ' '},
                     {id: Wings3D.action.toggleBodyMode, fn: toggleBodyMode, hotKey: ' '},
                   ];
   // bindMenu toolbar
   for (let button of toolBar) {
      UI.bindMenuItem(button.id.name, function(ev) {
         //ev.preventDefault();
         help( "wings3d - " + ev.currentTarget.id);
         button.fn();
       });
   }
   // bind .dropdown, .dropside click event.
   let buttons = document.querySelectorAll("li.dropdown > a");
   for (let button of buttons) {
      if (button.id) {
         let ul = button.nextElementSibling;  // popupMenu
         if (ul && ul.classList.contains("popupmenu")) {
            UI.bindMenuItem(button.id, function(ev) {
               UI.queuePopupMenu(ul);  // show popupMenu
             });
         }
      }
   }
   // bind li.dropside > a.
   buttons = document.querySelectorAll("li.dropside > a");
   for (let button of buttons) {
      if (button.id) {
         let ul = button.nextElementSibling;  // popupMenu
         if (ul && ul.classList.contains("popupmenu")) {
            UI.bindMenuItem(button.id, function(ev) {
               UI.toggleSubmenu(ul);  // slide in popup menu, replace the original one
               ev.stopPropagation();
             });
         }
      }
   }


   //Renderer.init(gl, drawWorld);  // init by itself
   draftBench = new DraftBench;

   // capture click mouse event.
   gl.canvas.addEventListener("mouseenter", canvasHandleMouseEnter, false);
   gl.canvas.addEventListener("mousedown", canvasHandleMouseDown, false); 
   gl.canvas.addEventListener("mouseup", canvasHandleMouseUp, false);
   gl.canvas.addEventListener("mouseleave", canvasHandleMouseLeave, false);
   gl.canvas.addEventListener("mousemove", canvasHandleMouseMove, false);
   gl.canvas.addEventListener("wheel", canvasHandleWheel, false);
   // bind context-menu
   let createObjectContextMenu = {menu: document.querySelector('#create-context-menu')};
   gl.canvas.addEventListener("contextmenu", function(e) {
      if(!canvasHandleContextMenu(e)) {
         e.preventDefault();
         let contextMenu = currentMode().getContextMenu();
         if (!contextMenu || !contextMenu.menu) {
            contextMenu = createObjectContextMenu;
         }
         UI.positionDom(contextMenu.menu, UI.getPosition(e));
         UI.showContextMenu(contextMenu.menu);
      }
   }, false);
   //console.log("Workspace init successful");
   let wavefront = new WavefrontObjImportExporter();

   // handle redrawingLoop
   function updateFrame(timestamp) {
      render(gl);
      requestAnimationFrame(updateFrame);
   };
   requestAnimationFrame(updateFrame);
};


export {
   // data
   prop,
   theme,
   draftBench,
   //world,   // we want iteration. can we share it?
   // function
   toggleVertexMode,
   toggleFaceMode,
   toggleEdgeMode,
   toggleBodyMode,
   restoreVertexMode,
   restoreFaceMode,
   restoreEdgeMode,
   restoreBodyMode,
   currentMode,
   // world state
   putIntoWorld,
   addToWorld,
   removeFromWorld,
   getWorld,
   updateWorld,
   makeCombineIntoWorld,
   // mouse handler
   //rayPick,
   attachHandlerMouseMove,
   attachHandlerMouseSelect,
   // undo/redo
   doCommand,
   redoEdit,
   undoEdit,
   undoQueue,
   undoQueueCombo,
   // rendering
   loadMatrices,
   projection,
   modelView,
   drawWorld,
   render
}; 

// register for initialization
Wings3D.onReady(init);