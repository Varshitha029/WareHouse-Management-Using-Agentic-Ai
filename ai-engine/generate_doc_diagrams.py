"""
generate_doc_diagrams.py  --  pure ASCII, no emoji
"""
import os, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "eval_results")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def rbox(ax, x, y, w, h, text, sub='', fc='#3f51b5', tc='white',
         fs=10, sfs=7.5, pad=0.18, zorder=3):
    ax.add_patch(FancyBboxPatch((x-w/2, y-h/2), w, h,
        boxstyle="round,pad=%.2f"%pad, facecolor=fc,
        edgecolor='white', linewidth=2.0, zorder=zorder))
    ax.text(x, y+(0.12 if sub else 0), text, ha='center', va='center',
            fontsize=fs, fontweight='bold', color=tc, zorder=zorder+1)
    if sub:
        ax.text(x, y-0.20, sub, ha='center', va='center',
                fontsize=sfs, color=tc, alpha=0.88, zorder=zorder+1)

def arr(ax, x1,y1,x2,y2, color='#555', lw=1.8, label='', lfs=7.5):
    ax.annotate('', xy=(x2,y2), xytext=(x1,y1),
        arrowprops=dict(arrowstyle='->', color=color, lw=lw,
                        connectionstyle='arc3,rad=0.0'), zorder=2)
    if label:
        ax.text((x1+x2)/2+0.07,(y1+y2)/2, label, ha='left', va='center',
                fontsize=lfs, color=color, style='italic')

# ===========================================================================
# DIAGRAM 1 -- System Architecture
# ===========================================================================
def make_system_architecture():
    fig,ax = plt.subplots(figsize=(15,9))
    ax.set_xlim(0,15); ax.set_ylim(0,9); ax.axis('off')
    fig.patch.set_facecolor('#f4f5f9')

    bands=[
        (7.3,8.8,'#dde3f8','PRESENTATION LAYER'),
        (5.2,7.2,'#d5f0ec','BUSINESS LOGIC LAYER'),
        (2.9,5.1,'#fce4ec','AI ENGINE LAYER'),
        (0.3,2.8,'#fff8e1','DATA LAYER'),
    ]
    for y1,y2,color,label in bands:
        ax.add_patch(FancyBboxPatch((0.5,y1),14.0,y2-y1,
            boxstyle='round,pad=0.1',facecolor=color,edgecolor='#ccc',
            linewidth=1.0,zorder=0,alpha=0.75))
        ax.text(0.72,(y1+y2)/2,label,ha='left',va='center',
                fontsize=7,color='#555',style='italic',rotation=90,zorder=1)

    rbox(ax, 3.8,8.05,2.8,0.72,'React.js SPA',       'Dashboard, AI Chat, Profile',  fc='#3949ab',fs=10,sfs=7.5)
    rbox(ax, 7.5,8.05,2.8,0.72,'Evaluation Dashboard','Charts, Radar, Metrics',       fc='#5c6bc0',fs=10,sfs=7.5)
    rbox(ax,11.2,8.05,2.8,0.72,'AuthContext / i18n',  'JWT, Multi-language support',  fc='#7986cb',fs=10,sfs=7.5)

    rbox(ax, 3.8,6.15,2.8,0.72,'Express REST API',   'auth, loans, transactions',    fc='#00796b',fs=10,sfs=7.5)
    rbox(ax, 7.5,6.15,2.8,0.72,'Razorpay Gateway',   '/create-order, /verify',       fc='#00897b',fs=10,sfs=7.5)
    rbox(ax,11.2,6.15,2.8,0.72,'Email / SMS',         'Nodemailer, Twilio',           fc='#26a69a',fs=10,sfs=7.5)

    for x in (3.8,7.5,11.2):
        arr(ax,x,7.68,x,6.52,color='#666',lw=1.6)

    rbox(ax, 2.3,4.0, 2.4,0.82,'FastAPI AI Engine', 'port 8000',                    fc='#c62828',fs=9.5,sfs=7.5)
    rbox(ax, 5.4,4.0, 2.4,0.82,'Master Agent',      'Coordinator + Router',         fc='#d32f2f',fs=9.5,sfs=7.5)
    rbox(ax, 8.5,4.0, 2.4,0.82,'Gemini 1.5 Flash',  'LLM intent + reasoning',       fc='#e53935',fs=9.5,sfs=7.5)
    rbox(ax,11.6,4.0, 2.4,0.82,'Flask ML Service',  'port 5001  (.pkl models)',      fc='#ef5350',fs=9.5,sfs=7.5)

    agents=['Inventory','Pricing','Duration','Loan Risk','Anomaly','Email']
    a_col =['#4caf50','#ff9800','#2196f3','#9c27b0','#795548','#00bcd4']
    for i,(ag,fc) in enumerate(zip(agents,a_col)):
        rbox(ax,1.5+i*2.2,3.1,1.9,0.50,ag,fc=fc,tc='white',fs=8,pad=0.1)

    arr(ax,5.4,3.59,5.4,3.36,color='#d32f2f',lw=1.4,label='route()')
    for x in (3.8,7.5,11.2):
        arr(ax,x,5.78,x if x<9 else 11.6,4.42,color='#aaa',lw=1.4)

    cols=['Users','Transactions','Loans','Vehicles','StorageAllocations','WarehouseLayouts']
    for i,col in enumerate(cols):
        rbox(ax,1.5+i*2.2,1.75,1.95,0.50,col,fc='#e65100',tc='white',fs=7.5,pad=0.09)

    rbox(ax,7.5,0.72,4.0,0.55,'MongoDB Atlas  --  NoSQL Document Store','',fc='#bf360c',fs=10)
    for x in (2.3,5.4,8.5,11.6):
        arr(ax,x,3.59,7.5 if x>6 else x,2.01,color='#bbb',lw=1.2)

    ax.text(7.5,8.72,
            'AI-Powered Warehouse Management System  --  System Architecture',
            ha='center',fontsize=13,fontweight='bold',color='#1a237e')

    patches=[
        mpatches.Patch(color='#dde3f8',label='Presentation  (React.js)'),
        mpatches.Patch(color='#d5f0ec',label='Business Logic  (Node.js)'),
        mpatches.Patch(color='#fce4ec',label='AI Engine  (Python)'),
        mpatches.Patch(color='#fff8e1',label='Data Layer  (MongoDB)'),
    ]
    ax.legend(handles=patches,loc='lower right',fontsize=8.5,framealpha=0.95,edgecolor='#bbb')

    plt.tight_layout()
    out=os.path.join(OUTPUT_DIR,'doc_system_architecture.png')
    plt.savefig(out,dpi=180,bbox_inches='tight'); plt.close()
    print("  Saved: "+out)


# ===========================================================================
# DIAGRAM 2 -- Multi-Agent Flow
# ===========================================================================
def make_multiagent_flow():
    fig,ax=plt.subplots(figsize=(14,10))
    ax.set_xlim(0,14); ax.set_ylim(0,10); ax.axis('off')
    fig.patch.set_facecolor('#fafafa')

    ax.text(7.0,9.65,'WMS -- Master-Coordinator Multi-Agent Architecture',
            ha='center',fontsize=13,fontweight='bold',color='#1a237e')
    ax.text(7.0,9.30,
            'User query  ->  Intent Classification  ->  Specialist Agent  ->  Chat Synthesis  ->  Response',
            ha='center',fontsize=9,color='#555',style='italic')

    rbox(ax,1.8,8.30,2.7,0.72,'User / Frontend','Natural language query',fc='#37474f',fs=10,sfs=8)
    rbox(ax,1.8,7.00,2.7,0.72,'n8n Webhook','wms-chat workflow',fc='#e65100',fs=10,sfs=8)
    arr(ax,1.8,7.93,1.8,7.37,color='#e65100',lw=2.0,label='HTTP POST')

    rbox(ax,7.0,7.00,3.2,0.82,'Master Agent','Orchestrator  --  auto_route()',fc='#3f51b5',fs=11,sfs=8.5)
    arr(ax,3.15,7.00,5.40,7.00,color='#3f51b5',lw=2.0,label='FastAPI')

    rbox(ax,7.0,5.70,3.0,0.72,'Intent Classifier','_classify_intent()  via Gemini LLM',fc='#5c6bc0',fs=9.5,sfs=8)
    arr(ax,7.0,6.59,7.0,6.07,color='#5c6bc0',lw=1.8)

    specialists=[
        ('Inventory Agent', '#4caf50','Stock & capacity'),
        ('Pricing Agent',   '#ff9800','Price forecasting'),
        ('Duration Agent',  '#2196f3','Storage prediction'),
        ('Loan Risk Agent', '#9c27b0','Credit scoring'),
        ('Anomaly Agent',   '#795548','Fraud detection'),
        ('Email Agent',     '#00bcd4','Draft notices'),
    ]
    xs=[1.1,3.3,5.5,8.5,10.7,12.9]
    y_sp=4.0
    for (label,color,sublabel),xp in zip(specialists,xs):
        rbox(ax,xp,y_sp,2.0,0.85,label,sublabel,fc=color,fs=8.5,sfs=7.2)
        ax.annotate('',xy=(xp,y_sp+0.43),xytext=(7.0,5.34),
            arrowprops=dict(arrowstyle='->',color=color,lw=1.2,
                            connectionstyle='arc3,rad=0.0'),zorder=2)
        ax.annotate('',xy=(7.0,2.53),xytext=(xp,y_sp-0.43),
            arrowprops=dict(arrowstyle='->',color=color,lw=1.0,
                            connectionstyle='arc3,rad=0.0'),zorder=2)

    rbox(ax,12.4,5.70,1.9,0.62,'Gemini AI','LLM reasoning',fc='#e53935',fs=8.5,sfs=7.5)
    rbox(ax,12.4,4.80,1.9,0.62,'MongoDB','DB Connector',fc='#e65100',fs=8.5,sfs=7.5)
    for y_side in (5.70,4.80):
        ax.annotate('',xy=(11.35,y_side),xytext=(8.60,7.00),
            arrowprops=dict(arrowstyle='->',color='#bbb',lw=1.2,
                            connectionstyle='arc3,rad=0.0'),zorder=2)

    rbox(ax,7.0,2.10,3.2,0.82,'Chat Agent',
         'Synthesises specialist data -> natural language reply',fc='#00897b',fs=10,sfs=8)
    ax.text(7.0,1.52,
            'Formats structured JSON results into a context-aware conversational response',
            ha='center',fontsize=8,color='#00695c',style='italic')

    ax.annotate('',xy=(1.8,6.63),xytext=(5.40,2.10),
        arrowprops=dict(arrowstyle='->',color='#00897b',lw=2.0,
                        connectionstyle='arc3,rad=-0.25'),zorder=2)
    ax.text(2.6,4.3,'Natural Language\nResponse',
            ha='center',fontsize=8.5,color='#00897b',fontweight='bold')

    ax.add_patch(FancyBboxPatch((0.4,0.30),13.2,0.88,
        boxstyle='round,pad=0.12',facecolor='#e8f5e9',
        edgecolor='#4caf50',linewidth=1.5,zorder=3))
    ax.text(7.0,0.74,
            'Full Analysis Mode:  asyncio.gather() runs all 5 specialist agents in PARALLEL',
            ha='center',va='center',fontsize=9,color='#2e7d32',fontweight='bold',zorder=4)
    ax.text(7.0,0.48,
            'Reduces response time from ~25 s (sequential) to ~5 s (concurrent)',
            ha='center',va='center',fontsize=8,color='#388e3c',zorder=4)

    plt.tight_layout()
    out=os.path.join(OUTPUT_DIR,'doc_multiagent_flow.png')
    plt.savefig(out,dpi=180,bbox_inches='tight'); plt.close()
    print("  Saved: "+out)


# ===========================================================================
# DIAGRAM 3 -- ML Pipeline
# ===========================================================================
def make_ml_pipeline():
    fig,ax=plt.subplots(figsize=(15,8))
    ax.set_xlim(0,15); ax.set_ylim(0,8); ax.axis('off')
    fig.patch.set_facecolor('#fafafa')

    ax.text(7.5,7.68,'WMS -- Machine Learning Pipeline',
            ha='center',fontsize=13,fontweight='bold',color='#1a237e')
    ax.text(7.5,7.35,
            'Data Collection  ->  Preprocessing  ->  Training  ->  Evaluation  ->  Inference API',
            ha='center',fontsize=9,color='#555',style='italic')

    ax.text(7.5,6.95,'[ OFFLINE TRAINING -- Jupyter Notebooks ]',
            ha='center',fontsize=9.5,color='#37474f',fontweight='bold')
    train_steps=[
        ('Raw CSV Data',          '#546e7a','CUSTOMER_ACTIVITIES\nGRAIN_MOVEMENTS'),
        ('Preprocessing / EDA',   '#5c6bc0','pd.cut() binning\nLabel Encoding'),
        ('3 Algorithms Compared', '#2e7d32','Logistic Reg\nDecision Tree\nRandom Forest'),
        ('Evaluation (F1-Score)', '#e65100','Train/Test Split\n5-Fold CV\nConfusion Matrix'),
        ('Best Model -> .pkl',    '#6a1b9a','model1_price\nmodel2_profit\nmodel3_duration'),
    ]
    xs_tr=[1.4,4.0,6.8,9.6,12.4]
    y_tr=5.85
    for i,((label,color,sublabel),xp) in enumerate(zip(train_steps,xs_tr)):
        rbox(ax,xp,y_tr,2.3,1.28,label,sublabel,fc=color,fs=9,sfs=7,pad=0.16)
        if i<len(train_steps)-1:
            arr(ax,xp+1.15,y_tr,xs_tr[i+1]-1.15,y_tr,color='#777',lw=1.8)

    ax.text(7.5,4.68,'[ THREE CLASSIFICATION MODELS ]',
            ha='center',fontsize=9.5,color='#37474f',fontweight='bold')
    models=[
        ('Model 1: Price Prediction',      '#c62828','Target: Low / Medium / High\n(3-class classification)'),
        ('Model 2: Profit Classification', '#6a1b9a','Target: Profit / Loss\n(binary classification)'),
        ('Model 3: Storage Duration',      '#1565c0','Target: Short / Medium / Long\n(3-class classification)'),
    ]
    for i,(label,color,sublabel) in enumerate(models):
        xp=2.5+i*5.0
        rbox(ax,xp,3.95,4.0,1.10,label,sublabel,fc=color,fs=10,sfs=8,pad=0.18)
        arr(ax,12.4,y_tr-0.65,xp,4.51,color='#bbb',lw=1.2)

    ax.text(7.5,3.12,'[ ONLINE INFERENCE -- Flask ML API, port 5001 ]',
            ha='center',fontsize=9.5,color='#37474f',fontweight='bold')
    infer_steps=[
        ('React\nFrontend',  '#3949ab',''),
        ('Node.js\nServer',  '#00796b','/api/predictions'),
        ('Flask\nML API',    '#c62828','/api/predict/*'),
        ('Feature\nEncoding','#e65100','grain_type\ntotal_bags\nduration_days'),
        ('Model\nPredict()', '#2e7d32','predict(X)\npredict_proba(X)'),
        ('JSON\nResponse',   '#4527a0','category +\nconfidence'),
    ]
    xs_in=[1.2,3.5,5.8,8.1,10.6,13.1]
    y_in=1.85
    for i,((label,color,sublabel),xp) in enumerate(zip(infer_steps,xs_in)):
        rbox(ax,xp,y_in,2.0,1.05,label,sublabel,fc=color,fs=9,sfs=7,pad=0.14)
        if i<len(infer_steps)-1:
            arr(ax,xp+1.0,y_in,xs_in[i+1]-1.0,y_in,color='#555',lw=1.6)

    for i in range(len(models)):
        xp=2.5+i*5.0
        arr(ax,xp,3.40,5.8,2.38,color='#bbb',lw=1.2)

    ax.add_patch(FancyBboxPatch((0.5,0.10),14.0,0.68,
        boxstyle='round,pad=0.10',facecolor='#e3f2fd',edgecolor='#1565c0',
        linewidth=1.5,zorder=3))
    ax.text(7.5,0.44,
            'Metrics:  Accuracy  |  Precision  |  Recall  |  F1-Score  |  5-Fold Cross-Validation  |  Confusion Matrix',
            ha='center',va='center',fontsize=9,color='#0d47a1',fontweight='bold',zorder=4)

    plt.tight_layout()
    out=os.path.join(OUTPUT_DIR,'doc_ml_pipeline.png')
    plt.savefig(out,dpi=180,bbox_inches='tight'); plt.close()
    print("  Saved: "+out)


if __name__=='__main__':
    print("\n  Generating documentation diagrams...\n")
    make_system_architecture()
    make_multiagent_flow()
    make_ml_pipeline()
    print("\n  Done. Files in: "+OUTPUT_DIR)