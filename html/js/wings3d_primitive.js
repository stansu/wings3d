/**
 * primitives maker
 * 
 */

import * as UI from './wings3d_ui.js';
import * as Wings3D from './wings3d.js';
import * as View from './wings3d_view.js';
import {Material} from './wings3d_material.js';
import {CreatePreviewCageCommand} from './wings3d_model.js';
import * as Shape from './wings3d_shape.js';



/**
 * @param {String} HTML representing a single element
 * @return {Element}
 */
const htmlToElement = (function() {
   const template = document.createElement('template');

   return function(html, ...handlers) {
      //html = html.trim(); // Never return a text node of whitespace as the result
      template.innerHTML = html;
      const element = template.content.firstChild;
      handlers.map(function(handler){
         element.addEventListener(handler[0], handler[1]);
       });

      return element;
   };
})();

function tag(html, ...theElems) {
   
   const ret = htmlToElement(html);

   theElems.map((element)=>{
      ret.appendChild(element);
    });
   return ret;
}

function listener(element, ...handlers) {
   for (let [event, listener] of handlers) {
      element.addEventListener(event, handler);
    }

   return element;
}

function hr() {
   return document.createElement('hr');
}

function sliderInput(name, value, handler) {
   const slider =  document.createElement("input");

   slider.addEventListener('change', handler);
   return slider;
}

function labelCheckbox(name, value, handler) {
   const label = document.createElement("label");
   let attribute = "";
   for (let [key, val] of Object.entries(value)) {
      attribute += ` ${key}='${val}'`;
   }
   const input = htmlToElement(`<input type='checkbox'${attribute}>`, ['change', handler]);

   label.appendChild(input);
   label.appendChild(document.createTextNode(name));
   return label;
};

function numberInput(name, value, handler) {
   const label = htmlToElement(`<label><span>${name}</span></label>`)
   let attribute = "";
   for (let [key, val] of Object.entries(value)) {
      attribute += ` ${key}='${val}'`;
   }
   const input = htmlToElement(`<input type='number'${attribute}>`, ['change', handler]);

   label.appendChild(input);
   return label;
};

function draggable(container, dragItem) {
   let currentX;
   let currentY;

   dragItem.addEventListener("mousedown", dragStart, false);
   dragItem.addEventListener("mouseup", dragEnd, false);
   dragItem.classList.add("draggable");

   function dragStart(e) {
      currentX = e.clientX;
      currentY = e.clientY;
      document.body.addEventListener("mousemove", drag, false);   // if attach to dragItem, mousemove could move out of focus.
      dragItem.classList.add("dragging");
   }

   function dragEnd(e) {
      dragItem.classList.remove("dragging");
      document.body.removeEventListener("mousemove", drag);
   }

   function drag(e) {
      e.preventDefault();
     
      container.style.top = (container.offsetTop + e.clientY - currentY) + "px";
      container.style.left = (container.offsetLeft + e.clientX - currentX) + "px";

      currentX = e.clientX;
      currentY = e.clientY;
   }
};




function makePrimitive(evt, name, maker, ...theDoms) {
   const form = htmlToElement('<form class="dialog small"></form>', 
                              ['reset', function(_evt){maker.reset();}], 
                              ['submit', function(evt){evt.preventDefault(); maker.confirm(); document.body.removeChild(form);}]);
   let header;
   form.appendChild(header = tag(`<h3 class="primitiveHeader">${name}</h3>`,
                               htmlToElement('<span class="close">&times;</span>', 
                              ['click', function(evt){maker.cancel(); document.body.removeChild(form);}]))
                               );
   if (theDoms) {
      form.appendChild( tag('<div class="primitiveOptions"></div', ...theDoms) );
   }

   // add common putOn
   let translateY;
   form.appendChild( 
      tag('<fieldset">',
         tag('<div class="horizontalPref alignCenter">',
            htmlToElement('<label>Rotate</label>'),
            tag('<span class="verticalPref">', numberInput('X', {value: 0, step: 1, name: 'rotate_x'}, function(evt) {maker.rotate(0, evt.target.value);}), 
               numberInput('Y', {value: 0, step: 1, name: 'rotate_y'}, function(evt) {maker.rotate(1, evt.target.value);}), 
               numberInput('Z', {value: 0, step: 1, name: 'rotate_z'}, function(evt) {maker.rotate(2, evt.target.value);})),
            htmlToElement('<label>Move</label>'),
            tag('<span class="verticalPref">', numberInput('X', {value: 0, step: 1, name: 'translate_x'}, function(evt) {maker.translate(0, evt.target.value);}), 
               translateY = numberInput('Y', {value: 0, step: 1, name: 'translate_y'}, function(evt) {maker.translate(1, evt.target.value);}), 
               numberInput('Z', {value: 0, step: 1, name: 'translate_z'}, function(evt) {maker.translate(2, evt.target.value);}))),
         labelCheckbox('Put on Ground', {name: 'ground'}, function(evt){
            const checked = evt.target.checked;
            translateY.disabled = checked;         // no translateY when we are attach to the ground.
            maker.putOnGround(checked);
          }))
    );

   // now add ok, reset button
   form.appendChild(tag('<div>', htmlToElement('<button type="reset" value="Reset">Reset</button>'), 
                               htmlToElement('<button type="submit" value="Ok">Ok</button>')
                       ));

   draggable(form, header);
   // display dialog, shown at the mouse location.   
   form.style.display = 'flex';
   UI.positionDom(form, UI.getPosition(evt));
   document.body.appendChild(form);
};



class PrimitiveMaker {
   constructor(name, maker, options) {
      this.name = name;
      this.cage = null;
      this.makeShape = maker;
      this.options = options;
      this.rotation = [0, 0, 0];
      this.translation = [0, 0, 0];
      this.ground = false;
      this.default = {};
      Object.assign(this.default, options);
   }

   cancel() {
      if (this.cage) {
         View.removeFromWorld(this.cage);
         this.cage.freeBuffer();
         this.cage = null;
      }
   }

   confirm() {
      View.undoQueue( new CreatePreviewCageCommand(this.cage) );
      PrimitiveMaker.reationCount++;
      this.cage.name = this.name + PrimitiveMaker.creationCount;
      // done
      this.cage = null;
   }

   make() {
      this.cancel();   // remove object first if any
      
      View.createIntoWorld((cage)=> {
         this.cage = cage;
         this.originY = this.makeShape(cage.geometry, Material.defaultMaterial, this.options);
         
         // transform.
         this.snapshot = cage.snapshotTransformBodyGroup(true);
         this.transform();         
       });
   }

   transform(restore) { // rotate and translate 
      let update = false;
      if (restore) {
         this.cage.restoreMoveSelection(restore);
         update = true;
      }
      // compute transform
      let angleQ = quat.create();
      quat.fromEuler(angleQ, this.rotation[0], this.rotation[1], this.rotation[2]);
      const transform = mat4.create();
      mat4.fromRotationTranslation(transform, angleQ, this.translation);
      if (this.ground) {
         transform[13] = -this.originY;   // move origin to (y=0)
      }

      // transform cage, if not identity.
      const identMat4 = mat4.create();
      mat4.identity(identMat4);
      if (!mat4.exactEquals(identMat4, transform)) {
         this.cage.transformSelection(this.snapshot, (working, _center)=> {
            mat4.copy(working, transform);
          });
          update = true;
      }
      if (update) {
         this.cage.updatePosition(this.snapshot);
      }
    }

   putOnGround(checked) {
      this.ground = checked;
      this.transform(this.snapshot);
   }

   reset() {
      Object.assign(this.options, this.default);
      this.ground = false;
      this.rotation = [0,0,0];
      this.translation = [0,0,0];
      this.make();
   }

   rotate(index, value) {
      this.rotation[index] = value;
      this.transform(this.snapshot);
   }

   translate(index, value) {
      this.translation[index] = value;
      this.transform(this.snapshot);
   }

   update(option, value) {
      this.options[option] = value;
      this.make();
   }
}
PrimitiveMaker.creationCount = 0;



function makeCone(mesh, material, options) {
   let centerY = -(options.height/2);
   Shape.makeCone(mesh, material, options.sections, options.height, centerY, options.r1, options.r2);
   return centerY;
};


/**
 * bind menu
 */
Wings3D.onReady(function() {
   const id = Wings3D.action.createCone.name;
   UI.bindMenuItem(id, function(ev) {
      const maker = new PrimitiveMaker("Cone", makeCone, {sections: 16, height: 2, r1: 1, r2: 1});
      maker.make();
      maker.confirm();
    });

   const handleCone = function(evt) {
      const maker = new PrimitiveMaker("Cone", makeCone, {sections: 16, height: 2, r1: 1, r2: 1});
      maker.make();
      makePrimitive(evt, "Cone Options Dialog", maker, 
         numberInput("Sections", {min: 3, value: 16, step: 1}, function(evt) {
            maker.update("sections", Number(evt.target.value));
          }),
         numberInput("Height", {min: 0, value: 2}, function(evt) {
            maker.update("height", Number(evt.target.value));
          }),
         numberInput("X Diameter", {min: 0, value: 2}, function(evt) {
            maker.update("r1", Number(evt.target.value)/2);
          }),
         numberInput("Z Diameter", {min: 0, value: 2}, function(evt) {
            maker.update("r2", Number(evt.target.value)/2);
          })
         );
    }

   UI.bindMenuItemRMB(id, handleCone);
   // preference optional dialog
   UI.bindMenuItem(Wings3D.action.createConePref.name, handleCone);   
});

export {
   makePrimitive
}