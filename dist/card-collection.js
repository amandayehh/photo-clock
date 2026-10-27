export const stackCardLimit=5;

// Archive photo data only; older stack cards release their DOM and rendering resources.
export function createCardCollection({mount,unmount}){
  let records=[],grid=false;
  const mounted=new Map();
  function reconcile(incomingImage){
    const visible=grid?records:records.slice(-stackCardLimit);
    const wanted=new Set(visible.map(record=>record.sequence));
    for(const [sequence,entry] of mounted){
      if(!wanted.has(sequence)){unmount(entry);mounted.delete(sequence);}
    }
    return visible.map(record=>{
      if(!mounted.has(record.sequence)){
        const image=record.sequence===records.length-1?incomingImage:undefined;
        mounted.set(record.sequence,mount(record.photo,record.sequence,image));
      }
      return mounted.get(record.sequence);
    });
  }
  return {
    add(photo,image){records.push({photo,sequence:records.length});return reconcile(image);},
    setGrid(value){grid=value;return reconcile();},
    clear(){for(const entry of mounted.values())unmount(entry);mounted.clear();records=[];}
  };
}
