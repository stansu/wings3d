/**
 * wrapping up cloudStorage and local storage
 * 
 */

import * as UI from './wings3d_ui.js';
import * as CloudStorage from './storages/cloudstorage.js';
import * as Dropbox from './storages/dropboxstorage.js';
import * as OneDrive from './storages/onedrivestorage.js';
import * as YandexDisk from './storages/yandexstorage.js';




class LocalFile extends CloudStorage.CloudFile {
   constructor(fileData) {
      super(fileData);
   }

   async arrayBuffer() {
      return this.file.arrayBuffer();
   }

   async text() {
      return this.file.text();
   }

   async upload(blob, _contentType) {
      window.saveAs(blob, this.file.name);
   }

   get directory() { // we cannot access local file's directory info.
      return '/';
   }

   get name() {
      return this.file.name;
   }
};


async function localSaveAsync(filename) {   // given a filename
   return new LocalFile({path: "", name: filename});
};


function setOptions() {
   let options = {
      success: function(file) {  
         //success handler  
      },
      progress: function(percent) { 
         //progress handler  
      },
      cancel: function() {  
         //cancel handler  
      },
      error: function (errorMessage) {

      },
      folderSVG: "./img/clouddisk.svg#folder",
   };
   CloudStorage.setOptions(options);
};

let cloudSaveDialog;
let _save = new Map;
let _lastSave = {};
let _workingSave = {};
function reset() {
   _lastSave = {};
   _workingSave = {};
}
function setWorkingFiles(working) {
   _lastSave = Object.assign(_workingSave, working);
   _workingSave = {};
};


async function saveAs(extension) {
   // popup windows 
   if (!cloudSaveDialog) {
      cloudSaveDialog = document.getElementById('cloudSaveDialog');
      if (!cloudSaveDialog) {
         throw new Error('No Save Dialog');
      }
      // first, setOptions
      setOptions();
      // now setup dropbox/onedrive/yandex/google/box/pcloud buttons
      let button = document.getElementById('dropboxSave');
      if (button) {
         _save.set(button, Dropbox.setupSaveButton(button));
      }
      button = document.getElementById('onedriveSave');
      if (button) {
         _save.set(button, OneDrive.setupSaveButton(button));
      }
      // setup local file store
      button = document.getElementById('localSave');
      if (button) {
         _save.set(button, [async function(fileInfo) {   // saveAs
            
            return new LocalFile(fileInfo);
           }, localSaveAsync]                
          );
      }
   }
      
   // show save storage selection dialog
   const [_form, button] = await UI.execDialog('#cloudSaveDialog', null);
   if (button.value === 'cancel') {
      throw new Error('No storage selected');
   }
   let [saveAsFn, saveFn] = _save.get(button);  // get the save routine
   _workingSave.saveFn = saveFn;
   
   // now get saveAs filename if possible
   const fileInfo = {path: "", name: "untitled" + '.' + extension, ext: [extension]};
   if (_lastSave.selected) {
      let [name, _ext] = CloudStorage.getFilenameAndExtension(_lastSave.selected.name);
      fileInfo.name = name + '.' + extension;
      fileInfo.path = _lastSave.selected.path;
   }
   // run the selected Storage's saveAs function.
   return saveAsFn(fileInfo).then(file=>{
      return [file, saveFn];
    });
};
/**
 * 
 */
async function save(extension) {
   if (_lastSave.selected) {
      return [_lastSave.selected, _lastSave.saveFn];
   } else {
      return saveAs(extension);
   }
};
 


let cloudOpenDialog;
let _open = new Map;
async function open(fileTypes) {
   // popup windows 
   if (!cloudOpenDialog) {
      cloudOpenDialog = document.getElementById('cloudOpenDialog');
      if (!cloudOpenDialog) {
         throw new Error('No OpenDialog');
      }
      // first, setOptions
      setOptions();
      // now setup dropbox/onedrive/yandex/google/box/pcloud buttons
      let button = document.getElementById('dropboxOpen');
      if (button) {
         _open.set(button, Dropbox.setupOpenButton(button));
      }
      button = document.getElementById('onedriveOpen');
      if (button) {
         _open.set(button, OneDrive.setupOpenButton(button));
      }
      button = document.getElementById('yandexDiskOpen');
      if (button) {
         _open.set(button, YandexDisk.setupOpenButton(button));
      }
      // setup local file open
      button = document.getElementById('localOpen');
      if (button) {
         _open.set(button, [async (fileTypes)=>{
                              return UI.openFileAsync(CloudStorage.getFileTypesString(fileTypes))
                                 .then(files=>{
                                    return files.map(file=>{return new LocalFile(file);});
                                 });
                              }, 
                            async (filename)=>{
                               return UI.openLinkedFileAsync(filename)
                               .then(files=>{
                                  return files.map(file=>{return new LocalFile(file);});
                               });
                              }, 
                            localSaveAsync]);
      }
   }

   // now show dialog
   const [_form, button] = await UI.execDialog('#cloudOpenDialog', null);
   if (button.value === "cancel") {
      throw new Error('No storage selected');
   }
   const [pick, open, saveFn] = _open.get(button);
   _workingSave.saveFn = saveFn;
   return pick(fileTypes).then(files=>{
      return [files, open];
    });
};


export {
   reset,
   setWorkingFiles,
   save,
   saveAs,
   open,
}