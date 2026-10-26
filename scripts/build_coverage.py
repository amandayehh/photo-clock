"""Rebuild source inventory and exact-minute coverage from the actual clock dataset."""
from collections import Counter
import csv
import html
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def summarize(photos):
    buckets=[{'commons':0,'flickr':0} for _ in range(1440)]
    seen=set()
    for photo in photos:
        identity=str(photo['pageid'])
        if identity in seen:
            continue
        seen.add(identity)
        source='flickr' if photo.get('source')=='flickr' else 'commons'
        if isinstance(photo.get('minute'),int) and 0<=photo['minute']<1440:
            buckets[photo['minute']][source]+=1
    commons={i for i,b in enumerate(buckets) if b['commons']}
    flickr={i for i,b in enumerate(buckets) if b['flickr']}
    return buckets,{'photos':len(seen),'covered_minutes':len(commons|flickr),'missing_minutes':1440-len(commons|flickr),
        'commons_minutes':len(commons),'flickr_minutes':len(flickr),'new_flickr_minutes':len(flickr-commons),
        'commons_photos':sum(b['commons'] for b in buckets),'flickr_photos':sum(b['flickr'] for b in buckets),
        'commons_with_flickr_origin':sum(bool(p.get('flickr_origin_ids')) for p in photos if p.get('source')!='flickr')}


def main():
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.colors import ListedColormap
    from matplotlib.patches import Patch
    data=json.loads((ROOT/'dist/photos.json').read_text())
    photos=data['photos'];buckets,stats=summarize(photos)
    baseline=data.get('expansion_baseline',{'photos':len(photos),'minutes':[i for i,b in enumerate(buckets) if sum(b.values())]})
    old_minutes=set(baseline['minutes'])
    stats.update({'baseline_photos':baseline['photos'],'baseline_minutes':len(old_minutes),'added_photos':len(photos)-baseline['photos'],'new_minutes':sum(bool(sum(b.values())) and i not in old_minutes for i,b in enumerate(buckets))})
    out=ROOT/'dist/reports';out.mkdir(parents=True,exist_ok=True)
    report={**stats,'collection_updated':data.get('updated'),
        'commons_expansion':data.get('commons_expansion'),
        'licenses':dict(Counter(p['license'] for p in photos)),
        'relevance':dict(Counter(p['relevance'] for p in photos)),
        'discovery_methods':dict(Counter(route for p in photos for route in p.get('discovery_routes',[])))}
    (out/'source-summary.json').write_text(json.dumps(report,indent=2)+'\n')
    with (out/'minute-coverage.csv').open('w',newline='') as f:
        writer=csv.writer(f);writer.writerow(['minute','time','commons_photos','flickr_photos','total'])
        for i,b in enumerate(buckets):writer.writerow([i,f'{i//60:02}:{i%60:02}',b['commons'],b['flickr'],sum(b.values())])
    fields=['pageid','source','time','title','artist','license','source_url','capture_original','timezone_status','relevance','flickr_origin_ids','discovery_routes']
    with (out/'source-inventory.csv').open('w',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader()
        for p in photos:
            row={k:p.get(k,'') for k in fields};row['source']=p.get('source','commons');row['time']=f'{p["minute"]//60:02}:{p["minute"]%60:02}'
            for k in ('flickr_origin_ids','discovery_routes'):row[k]='; '.join(p.get(k,[]))
            writer.writerow(row)
    values=[(1 if i in old_minutes else 2) if sum(b.values()) else 0 for i,b in enumerate(buckets)]
    colors=['#e9edf0','#267c75','#d18a31']
    fig,ax=plt.subplots(figsize=(15,8.4));fig.patch.set_facecolor('#fafaf8');ax.set_facecolor('#fafaf8')
    ax.imshow([values[h*60:(h+1)*60] for h in range(24)],cmap=ListedColormap(colors),vmin=0,vmax=2,aspect='auto',interpolation='nearest')
    ax.set_xticks(range(0,60,5),[f':{m:02}' for m in range(0,60,5)])
    ax.set_yticks(range(24),[f'{h:02}:00' for h in range(24)])
    ax.set_xticks([x-.5 for x in range(61)],minor=True);ax.set_yticks([y-.5 for y in range(25)],minor=True)
    ax.grid(which='minor',color='#fafaf8',linewidth=.7);ax.tick_params(which='minor',length=0)
    ax.set_xlabel('Minute within the hour');ax.set_ylabel('Recorded capture time, New York')
    for spine in ax.spines.values():spine.set_visible(False)
    fig.suptitle('New York Minute — photo availability',x=.09,ha='left',fontsize=23,fontweight='bold')
    fig.text(.09,.905,f'{stats["photos"]:,} photographs  ·  {stats["covered_minutes"]:,} / 1,440 exact minutes  ·  {stats["covered_minutes"]/14.4:.1f}% coverage',fontsize=12)
    labels=['No exact match','Previously covered','Newly covered']
    fig.legend(handles=[Patch(facecolor=c,label=l) for c,l in zip(colors,labels)],loc='lower left',bbox_to_anchor=(.08,.04),ncol=4,frameon=False)
    note=f'Commons expansion: +{stats["added_photos"]:,} photos · +{stats["new_minutes"]} exact minutes since the original {baseline["photos"]}-photo collection. Bounded sample, not a census.'
    fig.text(.09,.025,note,fontsize=10,color='#555')
    fig.subplots_adjust(left=.09,right=.98,top=.86,bottom=.17)
    fig.savefig(out/'coverage.png',dpi=160,facecolor=fig.get_facecolor());fig.savefig(out/'coverage.svg',facecolor=fig.get_facecolor());plt.close(fig)
    rows=''.join(f'<tr><td>{p["minute"]//60:02}:{p["minute"]%60:02}</td><td>{html.escape(p.get("source","commons"))}</td><td><a href="{html.escape(p["source_url"],quote=True)}">{html.escape(p["title"].removeprefix("File:"))}</a></td><td>{html.escape(p["artist"])}</td><td>{html.escape(p["license"])}</td></tr>' for p in sorted(photos,key=lambda p:p['minute']))
    page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New York Minute · Source coverage</title><style>body{max-width:1200px;margin:48px auto;padding:0 24px;font:16px/1.6 system-ui;color:#242827;background:#fafaf8}h1{font-size:38px;line-height:1.2}a{color:#226e68}img{width:100%;height:auto}.note{padding:16px 20px;background:#edf1ef;border-radius:10px}table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:10px;text-align:left;border-bottom:1px solid #ddd;vertical-align:top}.scroll{overflow:auto}summary{cursor:pointer;font-weight:600}footer{margin-top:40px;color:#666}</style><a href="./">← Back to the clock</a><h1>Every source. Every minute.</h1>'''
    page+=f'<p>{stats["photos"]} photos cover <strong>{stats["covered_minutes"]} exact minutes</strong>. {stats["missing_minutes"]} minutes have no exact match in the saved collection; the clock uses an earlier unseen photo.</p>'
    page+=f'<p class="note">{note} {stats["commons_with_flickr_origin"]} Commons records link to Flickr originals. All photographs are sourced through Wikimedia Commons; no paid Flickr API is used.</p>'
    page+='<img src="reports/coverage.svg" alt="24 by 60 grid of exact capture-minute availability. Download the minute CSV for every count."><p><a href="reports/coverage.png">Download map</a> · <a href="reports/minute-coverage.csv">Every minute · CSV</a> · <a href="reports/source-inventory.csv">Every source · CSV</a> · <a href="reports/source-summary.json">Audit summary · JSON</a></p>'
    page+=f'<details><summary>Browse all {len(photos)} source records</summary><div class="scroll"><table><thead><tr><th>Time</th><th>Provider</th><th>Photograph</th><th>Photographer</th><th>License</th></tr></thead><tbody>{rows}</tbody></table></div></details>'
    page+='<footer>Coverage describes the saved research collection, not everything available online. Camera times without recorded offsets are assumed local; camera clock accuracy is not independently verified. Discovery methods may overlap.</footer></html>'
    (ROOT/'dist/coverage.html').write_text(page)
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()
