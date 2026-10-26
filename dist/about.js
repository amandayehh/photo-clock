export function collectionUpdate(data){
  const exact=[data.monthly_check?.checked_at,data.commons_expansion?.checked_at]
    .filter(value=>typeof value==='string'&&Number.isFinite(Date.parse(value)))
    .sort((a,b)=>Date.parse(b)-Date.parse(a));
  const values=[...exact,data.updated];
  for(const value of values){
    if(typeof value!=='string'||!value.trim())continue;
    const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(value);
    const date=new Date(dateOnly?`${value}T12:00:00Z`:value);
    if(!Number.isFinite(date.getTime()))continue;
    const options={timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'};
    if(!dateOnly)Object.assign(options,{hour:'numeric',minute:'2-digit',timeZoneName:'short'});
    return {datetime:value,text:new Intl.DateTimeFormat('en-US',options).format(date)};
  }
  return null;
}

export function bindAboutPanel(button,panel,document,onOpen=()=>{}){
  function setOpen(open){panel.hidden=!open;button.setAttribute('aria-expanded',String(open));if(open)onOpen();}
  button.addEventListener('click',()=>setOpen(panel.hidden));
  document.addEventListener('pointerdown',event=>{
    if(!panel.hidden&&!panel.contains(event.target)&&!button.contains(event.target)){
      const hadFocus=panel.contains(document.activeElement);
      setOpen(false);
      if(hadFocus)button.focus({preventScroll:true});
    }
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!panel.hidden){
      event.preventDefault();setOpen(false);button.focus({preventScroll:true});
    }
  });
}
