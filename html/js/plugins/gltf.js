/**
 * GLTF 2 - loader/writer
 * 
 */

import {ImportExporter} from "../wings3d_importexport.js";
//import {Material, Texture} from "../wings3d_material.js";
import {Attribute} from "../wings3d_wingededge.js";
//import { PreviewCage } from "../wings3d_model.js";


const COMPONENT_TYPES = {
   5120: Int8Array,
   5121: Uint8Array,
   5122: Int16Array,
   5123: Uint16Array,
   5125: Uint32Array,
   5126: Float32Array
};
/*const COMPONENT_VIEWS = {
   5120: Int8View,
   5121: Uint8View,
   5122: Int16View,
   5123: Uint16View,
   5125: Uint32View,
   5126: Float32View
};*/
const TYPE_SIZES = {
   'SCALAR': 1,
   'VEC2': 2,
   'VEC3': 3,
   'VEC4': 4,
   'MAT2': 4,
   'MAT3': 9,
   'MAT4': 16
};
const BINARY_HEADR_MAGIC= "glTF";
const BINARY_EXTENSION_HEADER_LENGTH = 12;
const BINARY_EXTENSION_JSON_TYPES = 0x4E4F534A;
const BINARY_EXTENSION_BIN_TYPES  = 0x004E4942;

class GLTFImportExporter extends ImportExporter {
   constructor() {
      super(['GLTF', 'gltf, glb'], ['GLTF', 'gltf']);
      this.cache = {};
   }

   extension() {
      return "gltf";
   }

   fileTypes() {
      return ['gltf', 'glb'];
   }

   _reset() {
      super._reset();
      this.def = new Map;
      this.count = {appearance: 0, cage: 0};
   }

   /**
    * 
    * @param {*} text - file content as text.
    * 		path: path || this.resourcePath || '',
				crossOrigin: this.crossOrigin,
				manager: this.manager
    */
   async _import(content) {
      // check if glb,
      const data = await content.arrayBuffer();
      const magic = ImportExporter.decodeText( new Uint8Array(data, 0, 4) );
      if (magic === BINARY_HEADR_MAGIC) {
         this.parseGLB(data);
      } else {
         this.json = JSON.parse( ImportExporter.decodeText(data) );
      }
      this.vertex = new Map;
      this.uv = new Map;

      if ( this.json.asset === undefined || this.json.asset.version[ 0 ] < 2 ) {
         throw new Error( 'GLTF: Unsupported asset. Version < 2.0.' );
      } 
      if (this.json.scene === undefined) {
         throw new Error("No Scene");
      }

      // async pre load all buffers, images(texture) first.
      this.loadBuffers();
      this.loadImages();

      // load (scenes, nodes, meshes, material)
      const world = await this._parse('scenes', this.json.scene);1
      return {world: world, materialCatalog: Array.from(this.cache.materials.values())};
   }

   _parse(tag, index) {
      if (typeof this[tag] === 'function') {
         if (index === "undefined") {  // impossible, throw error
            console.log("no index");
         } else {
            let ret; 
            if (this.cache[tag] === undefined) {
               this.cache[tag] = new Map;
            } else {
               ret = this.cache[tag].get(index);  // check if in cache
            }
            if (ret === undefined) {
               const data = this.json[tag] || [];
               if (data.length > index) {// check index is within range
                  ret = this[tag](data[index]);
                  this.cache[tag].set(index, ret);
               } else { // throw error

               }
            }
            return ret;
         }
      }
   }

   parseGLB(data) {
      const chunkView = new DataView(data, 0);
      
      if ( chunkView.getUint32(4, true) < 2.0 ) {
			throw new Error("GLTF: Don't support 1.0 file.");
      }
      //const length = chunkView.getUint32(8, true);

		let chunkIndex = BINARY_EXTENSION_HEADER_LENGTH;

      while (chunkIndex < chunkView.byteLength) {
         let chunkLength = chunkView.getUint32(chunkIndex, true);
         chunkIndex += 4;
         let chunkType = chunkView.getUint32(chunkIndex, true);
         chunkIndex += 4;

         //json
         if (chunkType === BINARY_EXTENSION_JSON_TYPES) {
		      const contentArray = new Uint8Array(data, chunkIndex, chunkLength);
            this.json = JSON.parse( ImportExporter.decodeText(contentArray) );
         } else if (chunkType === BINARY_EXTENSION_BIN_TYPES) {
            this._bin = data.slice(chunkIndex, chunkIndex + chunkLength);
         }
         // dont support other extension yet

         chunkIndex += chunkLength;
      }

      if (!this.json) {
         throw new Error("GLTF: Invalid file, no JSON Chunk");
      }
   }

   loadBuffers() { // iterate over buffers.// _loadArrayBuffer(buffer.uri, loadArrayBufferCallback);
      const buffers = this.json.buffers || [];

      this.cache.buffers = new Map;
      let index = 0;
      for (let buffer of buffers) {  
         this.cache.buffers.set(index++, this.buffers(buffer));
      }  
   }

   loadImages() {
      const images = this.json.images || [];

      this.cache.images = new Map;
      let index = 0;
      for (let image of images) {  
         this.cache.images.set(index++, this.images(image));
      }
   }

   async getBuffer(index) {
      if (index < 0 || index >= this.cache.buffers.length) {
         throw new Error("out of range buffer index");
      }

      let ret = this.cache.buffers.get(index);
      if (!(ret instanceof ArrayBuffer)) {   // await our promise to return ArrayBuffer.
         ret = await ret;
         this.cache.buffers.set(index, ret);
      }
      return ret;
   }

   buffers(buffer) { // loadarraybuffer
      if (buffer.uri) {
         return this.loadAsync(buffer.uri)
            .then(files =>{return files[0].arrayBuffer();});
      } else { // glb buffer
         return Promise.resolve( this._bin );
      }
   }

   images(image) {
      if (image.uri) {
         return {loading: this.loadAsync(image.uri) 
                           .then(files=>{
                              return files[0].image();
                           }),
                  uri: image.uri};
      } else {
         return {loading: this._parse("bufferViews", image.bufferView)
                         .then(view=>{
                           const arrayView = new Uint8Array( view.buffer, view.byteOffset, view.byteLength );
                           const blob = new Blob( [arrayView], {type: image.mimeType} );
                           const img = document.createElement("img");
                           img.src = URL.createObjectURL(blob);
                           img.onload = function() {
                              URL.revokeObjectURL(this.src);
                           }
                           return img;
                         }),
                 uri: "Internal"};
      }
   }

   samplers(sampler) {
      return sampler;
   }

   textures(texture) {
      let sampler = this._parse('samplers', texture.sampler);
      let image = this.cache.images.get(texture.source);
      let ret = this.createTexture(image.uri, sampler);
      image.loading.then(img=>{
         img.onload = ()=> {
            ret.setImage(img);
         }
         return img;
      });

      return ret;
   }

   /**
    * https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#materials
    * @param {*} material 
    */
   materials(material) {
      const ret = this.createMaterial(material.name || "NoName");
      const metal = material.pbrMetallicRoughness;
      const pbr = {baseColor:[1, 1, 1], opacity: 1};
      if (metal) {
         if (Array.isArray(metal.baseColorFactor)) {
            pbr.baseColor = [metal.baseColorFactor[0], metal.baseColorFactor[1], metal.baseColorFactor[2]];
            pbr.opacity = metal.baseColorFactor[3];
         }
         if (metal.baseColorTexture) {
            ret.baseColorTexture = this._parse("textures", metal.baseColorTexture.index);
         }
         if (metal.metallicRoughnessTexture) {
            ret.roughnessTexture = this._parse("textures", metal.metallicRoughnessTexture.index);
         }

         if (metal.metallicFactor) pbr.metallic = metal.metallicFactor;   // already have default
         if (metal.roughness) pbr.roughness = metal.roughnessFactor; // already have default
      }
      if (material.normalTexture) {
         ret.normalTexture = this._parse("textures", material.normalTexture.index);
      }
      if (material.occlusionTexture) {
         ret.occlusionTexture = this._parse("textures", material.occlusionTexture.index);
      }
      if (material.emissiveTexture) {
         ret.emissionTexture = this._parse("textures", material.emissiveTexture.index);
      }
      if (material.emissiveFactor) {
         pbr.emission = material.emissiveFactor;
      }

      /** todo:
      material.alphaMode = "OPAQUE";
      material.alphaCutoff = 0.5;
      material.doubleSided = false;*/
      ret.setValues(pbr);
      return ret;
   }

   async accessors(accessor) {   // return typedarray: todo: how to solved interleaved one
      const itemSize = TYPE_SIZES[accessor.type];
      const TypedArray = COMPONENT_TYPES[accessor.componentType];
      if (!TypedArray || !itemSize) {
         // throw?   
      }
      const bufferView = await this._parse("bufferViews", accessor.bufferView);
      const itemBytes = TypedArray.BYTES_PER_ELEMENT * itemSize;
      const byteOffset = (accessor.byteOffset || 0) + bufferView.byteOffset;
      const byteStride = bufferView.byteStride || itemBytes;
      const arrayLength = accessor.count * itemSize;
      if (byteStride !== itemBytes) {  // interleaved array
         throw new UserException('No interleaved array support'); // todo: get support
      } else {
         return new TypedArray( bufferView.buffer, byteOffset, arrayLength);
      }
   }

   async bufferViews(view) {  // load cached buffer
      //view.buffer = undefined;
      view.byteOffset = view.byteOffset || 0;
      //view.byteLength = undefined;
      //view.byteStride = 0;
      //view.target = undefined;
      //view.name = undefined;
      view.buffer = await this.getBuffer(view.buffer);
      return view;
   }

   addTriangles(index, pos, uv, material) {
      if (index) {
         for (let i = 0; i < index.length; i+=3) {
            let hEdge = this.geometry.addPolygon([pos[index[i]], pos[index[i+1]], pos[index[i+2]]], material).halfEdge;
            if (uv) {
               hEdge.setUV(uv[index[i]]);
               hEdge = hEdge.next;
               hEdge.setUV(uv[index[i+1]]);
               hEdge = hEdge.next;
               hEdge.setUV(uv[index[i+2]]);
            }
         }
      } else { // array of triangles, no index.

      }
   }

   async meshes(mesh) {
      const ret = this.createCage(mesh.name);
      this.geometry = ret.geometry;
      for (let primitive of mesh.primitives) {
         const attr = primitive.attributes || {};
         let index = await this._parse('accessors', primitive.indices);
         let material = await this._parse('materials', primitive.material);
         
         // position
         let position = await this._parse('accessors', attr.POSITION);
         let pos = this.vertex.get(position);
         if (pos === undefined) { 
            pos = [];
            for (let i = 0; i < position.length; i+=3) {
               pos.push( this.geometry.addVertex([position[i], position[i+1], position[i+2]]).index );
            }
            this.vertex.set(position, pos);
         }
         // texcoord_0
         let uv;
         if (attr.TEXCOORD_0) {
            let texCoord0 = await this._parse('accessors', attr.TEXCOORD_0);
            let texCoord1;
            if (attr.TEXCOORD_1) {
               texCoord1 = await this._parse('accessors', attr.TEXCOORD_1);
            }
            uv = this.uv.get(texCoord0);
            if (uv === undefined) {
               uv = [];
               for (let i = 0; i < texCoord0.length; i+=2) {
                  let index = Attribute.uv.reserve();
                  uv.push(index);
                  Attribute.uv.setChannel(index, 0, [texCoord0[i], texCoord0[i+1]]);
                  if (texCoord1) {
                     Attribute.uv.setChannel(index, 1, [texCoord1[i], texCoord1[i+1]]);
                  }
               }
               this.uv.set(texCoord0, uv);
            }
         }

         if ((primitive.mode === undefined) || (primitive.mode === 4)) {   // only mode 4 currently
            this.addTriangles(index, pos, uv, material);
         }  // todo: mode 5, mode 6
      }
      //ret.updateAffected();
      return ret;
   }

   async nodes(node) {
      // recursive load children if any
      if (node.children !== undefined) {
         let group = this.createGroup(node.name);
         for (let child of node.children) {
            let res = await this._parse('nodes', child);
            group.insert( res );
            //group.insert( await this._parse('nodes', child) );
         }
         return group;
      } else {
         if (node.mesh !== undefined) {
            return await this._parse('meshes', node.mesh);
         }
      }
      throw(new Error("unable to handle nodes"));
   }

   async scenes(scene) {   // load scene, using nodes
      //this.scene = View.putIntoWorld();
      let world = [];
      for (let i of scene.nodes) {
         world.push( await this._parse("nodes", i) );
      }
      //return this.scene;
      return world;
   }

};

export {
   GLTFImportExporter
}

/* CONSTANTS 

	var WEBGL_CONSTANTS = {
		FLOAT: 5126,
		//FLOAT_MAT2: 35674,
		FLOAT_MAT3: 35675,
		FLOAT_MAT4: 35676,
		FLOAT_VEC2: 35664,
		FLOAT_VEC3: 35665,
		FLOAT_VEC4: 35666,
		LINEAR: 9729,
		REPEAT: 10497,
		SAMPLER_2D: 35678,
		POINTS: 0,
		LINES: 1,
		LINE_LOOP: 2,
		LINE_STRIP: 3,
		TRIANGLES: 4,
		TRIANGLE_STRIP: 5,
		TRIANGLE_FAN: 6,
		UNSIGNED_BYTE: 5121,
		UNSIGNED_SHORT: 5123
	};



	var WEBGL_FILTERS = {
		9728: THREE.NearestFilter,
		9729: THREE.LinearFilter,
		9984: THREE.NearestMipmapNearestFilter,
		9985: THREE.LinearMipmapNearestFilter,
		9986: THREE.NearestMipmapLinearFilter,
		9987: THREE.LinearMipmapLinearFilter
	};

	var WEBGL_WRAPPINGS = {
		33071: THREE.ClampToEdgeWrapping,
		33648: THREE.MirroredRepeatWrapping,
		10497: THREE.RepeatWrapping
	};



	var ATTRIBUTES = {
		POSITION: 'position',
		NORMAL: 'normal',
		TANGENT: 'tangent',
		TEXCOORD_0: 'uv',
		TEXCOORD_1: 'uv2',
		COLOR_0: 'color',
		WEIGHTS_0: 'skinWeight',
		JOINTS_0: 'skinIndex',
	};

	var PATH_PROPERTIES = {
		scale: 'scale',
		translation: 'position',
		rotation: 'quaternion',
		weights: 'morphTargetInfluences'
	};

	var INTERPOLATION = {
		CUBICSPLINE: undefined, // We use a custom interpolant (GLTFCubicSplineInterpolation) for CUBICSPLINE tracks. Each
		                        // keyframe track will be initialized with a default interpolation type, then modified.
		LINEAR: THREE.InterpolateLinear,
		STEP: THREE.InterpolateDiscrete
	};

	var ALPHA_MODES = {
		OPAQUE: 'OPAQUE',
		MASK: 'MASK',
		BLEND: 'BLEND'
	};

	var MIME_TYPE_FORMATS = {
		'image/png': THREE.RGBAFormat,
		'image/jpeg': THREE.RGBFormat
	};

*/