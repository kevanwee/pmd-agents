import {resolve} from 'node:path';
import {RAW} from './importer';
import {ensureFiles,fetchUrl} from './gamedata';
/** The desktop widget's window and tray icon: Appletun's Idle sheet from the pinned SpriteCollab revision
 *  (credit: Emmuffin). It is fetched into the local pack with a receipt like every other sprite, never bundled;
 *  the companion cuts the first frame of the front-facing row. */
export const WIDGET_ICON={url:RAW+'sprite/0842/Idle-Anim.png',file:'icons/appletun-idle.png',frameWidth:40,frameHeight:40};
/** The icon's absolute path in the pack, or undefined when it cannot be fetched (the generic icon stays). */
export async function ensureWidgetIcon(root:string,get:(url:string,limit?:number)=>Promise<Uint8Array>=fetchUrl){
 const {ready}=await ensureFiles(root,[{key:'icon',url:WIDGET_ICON.url,file:WIDGET_ICON.file}],get,'icons/receipts.json');
 return ready.icon?resolve(root,ready.icon):undefined;
}
