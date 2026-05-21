(function start(){
  if(typeof THREE==='undefined') return setTimeout(start,80);
  try{run();}catch(e){
    const eb=document.getElementById('errbox5');
    if(eb){eb.style.display='block';eb.textContent='err: '+(e.message||e);}
  }
  function run(){
    const cvs=document.getElementById('cvs5');
    const W=cvs.clientWidth||680, H=cvs.clientHeight||500;
    cvs.width=W; cvs.height=H;

    // === SIZES (20% smaller) ===
    const MAIN_SIZE=2.4;
    const SIDE_SIZE=1.36;

    const renderer=new THREE.WebGLRenderer({canvas:cvs,antialias:true,alpha:false});
    renderer.setSize(W,H,false);
    renderer.setClearColor(0x000308);
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.05;

    const scene=new THREE.Scene();
    scene.fog=new THREE.FogExp2(0x000a14,0.026);

    const camera=new THREE.PerspectiveCamera(38,W/H,0.1,120);
    camera.position.set(11,7,14);
    camera.lookAt(0,0,0);

    scene.add(new THREE.AmbientLight(0x002030,2.2));
    const kL=new THREE.PointLight(0x22ffdd,11,28);kL.position.set(0,4,4);scene.add(kL);
    const fL=new THREE.PointLight(0x0055aa,5,26);fL.position.set(-8,3,-5);scene.add(fL);
    const bL=new THREE.PointLight(0x00ffaa,3.5,18);bL.position.set(3,-2,5);scene.add(bL);

    const codeSnips=[
      'verify_ai_expert(id);','expert_t* e = lookup(id);','e->reputation = 0x4a8f2e1b;',
      'e->verified = TRUE;','trade_t* tx = create_trade();','tx->expert_id = e->id;',
      'tx->amount = 2400.00;','if (escrow_lock(tx)==OK) {','  validate_credentials(e);',
      '  release_knowhow(tx);','  emit_event("traded");','}','// 1,247 verified experts',
      '// trades_total: 89,422','// success_rate: 99.8%','safe_transaction(tx, addr);',
      'if(bal >= tx->fee) commit();','pool.push(verified_tx);','square.broadcast(trade);',
      'return EXIT_SUCCESS;'
    ];

    function makeCodeTex(seed){
      const cv=document.createElement('canvas');
      cv.width=256;cv.height=256;
      const ctx=cv.getContext('2d');
      ctx.font='8px Consolas, Monaco, monospace';
      for(let i=0;i<24;i++){
        const li=(seed+i*3)%codeSnips.length;
        const a=0.55+Math.random()*0.45;
        ctx.fillStyle='rgba(190,255,240,'+a.toFixed(2)+')';
        ctx.fillText(codeSnips[li],6+Math.random()*4,12+i*10);
      }
      ctx.fillStyle='rgba(255,255,255,0.95)';
      for(let i=0;i<22;i++) ctx.fillRect(Math.random()*256,Math.random()*256,1,1);
      const tex=new THREE.CanvasTexture(cv);
      tex.minFilter=THREE.LinearFilter;
      return tex;
    }

    function buildCube(size){
      const g=new THREE.Group();
      const h=size/2;

      const core=new THREE.Mesh(
        new THREE.BoxGeometry(size*0.92,size*0.92,size*0.92),
        new THREE.MeshBasicMaterial({color:0x086268,transparent:true,opacity:1.0})
      );
      g.add(core);

      g.add(new THREE.Mesh(
        new THREE.BoxGeometry(size*0.94,size*0.94,size*0.94),
        new THREE.MeshBasicMaterial({color:0x00b8b0,transparent:true,opacity:0.35,side:THREE.BackSide,depthWrite:false})
      ));

      const faces=[
        {p:[0,0,h-0.003],r:[0,0,0]},
        {p:[0,0,-h+0.003],r:[0,Math.PI,0]},
        {p:[h-0.003,0,0],r:[0,Math.PI/2,0]},
        {p:[-h+0.003,0,0],r:[0,-Math.PI/2,0]},
        {p:[0,h-0.003,0],r:[-Math.PI/2,0,0]},
        {p:[0,-h+0.003,0],r:[Math.PI/2,0,0]}
      ];
      const faceMeshes=[];
      for(let i=0;i<faces.length;i++){
        const f=faces[i];
        const tex=makeCodeTex(i*7+Math.floor(Math.random()*5));
        const m=new THREE.Mesh(
          new THREE.PlaneGeometry(size*0.96,size*0.96),
          new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide})
        );
        m.position.set(f.p[0],f.p[1],f.p[2]);
        m.rotation.set(f.r[0],f.r[1],f.r[2]);
        m.userData={offset:Math.random()};
        g.add(m);
        faceMeshes.push(m);
      }

      g.add(new THREE.Mesh(
        new THREE.BoxGeometry(size,size,size),
        new THREE.MeshBasicMaterial({color:0x00d0c0,transparent:true,opacity:0.22,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false})
      ));

      const sub=size/3;
      const iMat=new THREE.LineBasicMaterial({color:0x66ffee,transparent:true,opacity:0.5,blending:THREE.AdditiveBlending,depthWrite:false});
      const segs=[
        [[-sub,-h,h],[-sub,h,h]],[[sub,-h,h],[sub,h,h]],
        [[-sub,-h,-h],[-sub,h,-h]],[[sub,-h,-h],[sub,h,-h]],
        [[-h,-sub,h],[h,-sub,h]],[[-h,sub,h],[h,sub,h]],
        [[-h,-sub,-h],[h,-sub,-h]],[[-h,sub,-h],[h,sub,-h]],
        [[-h,-sub,sub],[-h,sub,sub]],[[-h,-sub,-sub],[-h,sub,-sub]],
        [[h,-sub,sub],[h,sub,sub]],[[h,-sub,-sub],[h,sub,-sub]],
        [[-sub,h,-h],[-sub,h,h]],[[sub,h,-h],[sub,h,h]],
        [[-h,h,-sub],[h,h,-sub]],[[-h,h,sub],[h,h,sub]],
        [[-sub,-h,-h],[-sub,-h,h]],[[sub,-h,-h],[sub,-h,h]],
        [[-h,-h,-sub],[h,-h,-sub]],[[-h,-h,sub],[h,-h,sub]]
      ];
      for(let i=0;i<segs.length;i++){
        const a=segs[i][0], b=segs[i][1];
        const lg=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0],a[1],a[2]),new THREE.Vector3(b[0],b[1],b[2])]);
        g.add(new THREE.Line(lg,iMat));
      }

      const eGeo=new THREE.EdgesGeometry(new THREE.BoxGeometry(size,size,size));
      g.add(new THREE.LineSegments(eGeo,new THREE.LineBasicMaterial({color:0x88ffee,transparent:true,opacity:1.0})));
      const halos=[{s:1.018,o:0.6,c:0x66eedd},{s:1.04,o:0.32,c:0x33bbbb},{s:1.075,o:0.14,c:0x008899},{s:1.12,o:0.06,c:0x005577}];
      for(let i=0;i<halos.length;i++){
        const ln=new THREE.LineSegments(eGeo,new THREE.LineBasicMaterial({color:halos[i].c,transparent:true,opacity:halos[i].o,blending:THREE.AdditiveBlending,depthWrite:false}));
        ln.scale.setScalar(halos[i].s);
        g.add(ln);
      }

      g.traverse(function(o){
        if(o.material){
          o.material.transparent=true;
          o.userData.origOpacity=o.material.opacity;
        }
      });

      g.userData.faceMeshes=faceMeshes;
      g.userData.size=size;
      return g;
    }

    function setCubeAlpha(cube,alpha){
      cube.traverse(function(o){
        if(o.material && o.userData.origOpacity!==undefined){
          o.material.opacity=o.userData.origOpacity*alpha;
        }
      });
    }

    const mainCube=buildCube(MAIN_SIZE);
    scene.add(mainCube);
    setCubeAlpha(mainCube,0);

    const sideCubes=[];
    const sidePos=[[5.5,0.2,0],[-5.5,0.2,0],[0,0.2,5.5],[0,0.2,-5.5]];
    for(let i=0;i<sidePos.length;i++){
      const p=sidePos[i];
      const sc=buildCube(SIDE_SIZE);
      sc.position.set(p[0],p[1],p[2]);
      scene.add(sc);
      setCubeAlpha(sc,0);
      sideCubes.push(sc);
    }

    function buildBeam(s,e){
      const dir=new THREE.Vector3().subVectors(e,s);
      const len=dir.length();
      const beam=new THREE.Mesh(new THREE.PlaneGeometry(0.18,len),new THREE.MeshBasicMaterial({color:0x44ffdd,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
      const mid=new THREE.Vector3().copy(s).lerp(e,0.5);
      beam.position.copy(mid); beam.lookAt(e); beam.rotateX(Math.PI/2);
      const halo=new THREE.Mesh(new THREE.PlaneGeometry(0.6,len),new THREE.MeshBasicMaterial({color:0x00aacc,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
      halo.position.copy(mid); halo.rotation.copy(beam.rotation);
      return {beam:beam,halo:halo,start:s.clone(),end:e.clone()};
    }
    const beams=[];
    for(let i=0;i<sidePos.length;i++){
      const p=sidePos[i];
      const s=new THREE.Vector3(p[0],p[1],p[2]);
      const e=new THREE.Vector3(0,0.2,0);
      const d=new THREE.Vector3().subVectors(e,s).normalize();
      // pull beam endpoints in to match smaller cubes
      const s2=s.clone().add(d.clone().multiplyScalar(SIDE_SIZE*0.6));
      const e2=e.clone().sub(d.clone().multiplyScalar(MAIN_SIZE*0.6));
      const b=buildBeam(s2,e2);
      scene.add(b.beam); scene.add(b.halo);
      beams.push(b);
    }

    const FDOTS=80;
    const flowGeo=new THREE.BufferGeometry();
    const flowPos=new Float32Array(FDOTS*3);
    const flowMeta=[];
    for(let i=0;i<FDOTS;i++) flowMeta.push({beam:beams[i%beams.length],t:Math.random()});
    flowGeo.setAttribute('position',new THREE.BufferAttribute(flowPos,3));
    const flowMat=new THREE.PointsMaterial({color:0xaaffee,size:0.14,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
    scene.add(new THREE.Points(flowGeo,flowMat));

    const floorY=-1.4;
    const floorBase=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshBasicMaterial({color:0x000508}));
    floorBase.rotation.x=-Math.PI/2; floorBase.position.y=floorY;
    scene.add(floorBase);

    const fgMat=new THREE.LineBasicMaterial({color:0x002f44,transparent:true,opacity:0.85});
    for(let i=0;i<=44;i++){
      const p=i/44*60-30;
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p,floorY+0.005,-30),new THREE.Vector3(p,floorY+0.005,30)]),fgMat));
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-30,floorY+0.005,p),new THREE.Vector3(30,floorY+0.005,p)]),fgMat));
    }

    const trMat=new THREE.LineBasicMaterial({color:0x00aaee,transparent:true,opacity:0.85,blending:THREE.AdditiveBlending});
    const orMat=new THREE.LineBasicMaterial({color:0xff5522,transparent:true,opacity:0.6,blending:THREE.AdditiveBlending});
    const traces=[
      [[-9,floorY+0.01,-9],[-9,floorY+0.01,9],[9,floorY+0.01,9],[9,floorY+0.01,-9],[-9,floorY+0.01,-9]],
      [[-16,floorY+0.01,-16],[-16,floorY+0.01,16],[16,floorY+0.01,16],[16,floorY+0.01,-16],[-16,floorY+0.01,-16]],
      [[-9,floorY+0.01,0],[-16,floorY+0.01,0]],[[9,floorY+0.01,0],[16,floorY+0.01,0]],
      [[0,floorY+0.01,-9],[0,floorY+0.01,-16]],[[0,floorY+0.01,9],[0,floorY+0.01,16]],
      [[-16,floorY+0.01,-9],[-9,floorY+0.01,-9]],[[16,floorY+0.01,9],[9,floorY+0.01,9]],
      [[-13,floorY+0.01,-13],[-13,floorY+0.01,-9]],[[13,floorY+0.01,13],[13,floorY+0.01,9]]
    ];
    for(let i=0;i<traces.length;i++){
      const pts=[];
      for(let j=0;j<traces[i].length;j++) pts.push(new THREE.Vector3(traces[i][j][0],traces[i][j][1],traces[i][j][2]));
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),trMat));
    }
    for(let i=0;i<40;i++){
      const x=(Math.random()-0.5)*52, z=(Math.random()-0.5)*52;
      const len=0.4+Math.random()*1.6;
      const horiz=Math.random()>0.5;
      const pts=horiz?[new THREE.Vector3(x,floorY+0.01,z),new THREE.Vector3(x+len,floorY+0.01,z)]
                     :[new THREE.Vector3(x,floorY+0.01,z),new THREE.Vector3(x,floorY+0.01,z+len)];
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),i%4===0?orMat:trMat));
    }

    function discAt(x,z,r,col,op){
      const m=new THREE.Mesh(new THREE.CircleGeometry(r,48),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false}));
      m.rotation.x=-Math.PI/2; m.position.set(x,floorY+0.02,z);
      scene.add(m); return m;
    }
    const mainDisc=discAt(0,0,3.0,0x00ccaa,0);
    const mainDisc2=discAt(0,0,5.2,0x0066aa,0);
    const sideDiscs=[];
    for(let i=0;i<sidePos.length;i++) sideDiscs.push(discAt(sidePos[i][0],sidePos[i][2],1.8,0x00bbaa,0));

    const ATM=350;
    const atmGeo=new THREE.BufferGeometry();
    const atmPos=new Float32Array(ATM*3);
    const atmVel=new Float32Array(ATM*3);
    for(let i=0;i<ATM;i++){
      atmPos[i*3]=(Math.random()-0.5)*16;
      atmPos[i*3+1]=Math.random()*6-1.5;
      atmPos[i*3+2]=(Math.random()-0.5)*16;
      atmVel[i*3]=(Math.random()-0.5)*0.008;
      atmVel[i*3+1]=Math.random()*0.012+0.003;
      atmVel[i*3+2]=(Math.random()-0.5)*0.008;
    }
    atmGeo.setAttribute('position',new THREE.BufferAttribute(atmPos,3));
    scene.add(new THREE.Points(atmGeo,new THREE.PointsMaterial({color:0x88eedd,size:0.04,transparent:true,opacity:0.5,blending:THREE.AdditiveBlending,depthWrite:false})));

    const sGeo=new THREE.BufferGeometry();
    const sv=[];
    for(let i=0;i<700;i++) sv.push((Math.random()-0.5)*140,(Math.random()-0.5)*80,(Math.random()-0.5)*80-20);
    sGeo.setAttribute('position',new THREE.Float32BufferAttribute(sv,3));
    scene.add(new THREE.Points(sGeo,new THREE.PointsMaterial({color:0x223344,size:0.05,transparent:true,opacity:0.7})));

    let composer=null, bloom=null;
    if(typeof THREE.EffectComposer!=='undefined' && typeof THREE.UnrealBloomPass!=='undefined' && typeof THREE.RenderPass!=='undefined'){
      try{
        composer=new THREE.EffectComposer(renderer);
        composer.addPass(new THREE.RenderPass(scene,camera));
        bloom=new THREE.UnrealBloomPass(new THREE.Vector2(W,H),1.35,0.78,0.18);
        composer.addPass(bloom);
      }catch(e){composer=null;}
    }

    const overlay=document.getElementById('overlay5');
    const lw=document.getElementById('lw5'),lp=document.getElementById('lp5'),lbar=document.getElementById('lbar5');
    const loadWrap=document.getElementById('load5'),titleBlock=document.getElementById('tblk5');
    const topbar=document.getElementById('topbar5'),botbar=document.getElementById('botbar5'),scrollEl=document.getElementById('scr5');
    const words=['VERIFY','VALIDATE','PROTECT','SECURE','CONNECT','TRADE','TRUST','SQUARE'];
    let lastWi=-1;

    const F_LOAD=130, F_REVEAL=260, F_ROTATE=380, F_EXPAND=560, F_TITLE=740, F_HOLD=960, F_FADEOUT=1100;

    const easeOut=function(t){return 1-Math.pow(1-t,3);};
    const easeInOut=function(t){return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;};

    let frame=0;
    function animate(){
      requestAnimationFrame(animate);
      try{
        frame=(frame+1)%F_FADEOUT;
        const t=frame*0.01;

        for(let i=0;i<ATM;i++){
          atmPos[i*3]+=atmVel[i*3];
          atmPos[i*3+1]+=atmVel[i*3+1];
          atmPos[i*3+2]+=atmVel[i*3+2];
          if(atmPos[i*3+1]>5){
            atmPos[i*3+1]=-1.5;
            atmPos[i*3]=(Math.random()-0.5)*16;
            atmPos[i*3+2]=(Math.random()-0.5)*16;
          }
        }
        atmGeo.attributes.position.needsUpdate=true;

        mainCube.position.y=Math.sin(t*0.7)*0.12;
        mainCube.rotation.y=t*0.15;
        for(let i=0;i<sideCubes.length;i++){
          sideCubes[i].position.y=0.2+Math.sin(t*0.8+i)*0.1;
          sideCubes[i].rotation.y=t*0.2+i*0.4;
        }

        const fm=mainCube.userData.faceMeshes;
        for(let i=0;i<fm.length;i++){
          if(fm[i].material.map) fm[i].material.map.offset.y=(t*0.05+fm[i].userData.offset)%1;
        }

        if(frame<F_LOAD){
          overlay.style.opacity='1';
          const p=frame/F_LOAD;
          loadWrap.style.opacity=(p<0.15?p/0.15:p>0.9?(1-p)/0.1:1).toFixed(2);
          const wi=Math.min(words.length-1,Math.floor(p*words.length));
          if(wi!==lastWi){lw.textContent=words[wi];lastWi=wi;}
          lp.textContent=Math.round(p*100)+'%';
          lbar.style.width=(p*100).toFixed(0)+'%';
          setCubeAlpha(mainCube,0);
          for(let i=0;i<sideCubes.length;i++) setCubeAlpha(sideCubes[i],0);
          for(let i=0;i<beams.length;i++){beams[i].beam.material.opacity=0;beams[i].halo.material.opacity=0;}
          flowMat.opacity=0;
          for(let i=0;i<sideDiscs.length;i++) sideDiscs[i].material.opacity=0;
          mainDisc.material.opacity=0; mainDisc2.material.opacity=0;
          topbar.style.opacity=0; titleBlock.style.opacity=0;
          botbar.style.opacity=0; scrollEl.style.opacity=0;
        }
        else if(frame<F_REVEAL){
          loadWrap.style.opacity=0;
          const p=easeInOut((frame-F_LOAD)/(F_REVEAL-F_LOAD));
          overlay.style.opacity=(1-p).toFixed(3);
          setCubeAlpha(mainCube,p);
          for(let i=0;i<sideCubes.length;i++) setCubeAlpha(sideCubes[i],0);
          mainDisc.material.opacity=p*0.22;
          mainDisc2.material.opacity=p*0.12;
          if(bloom) bloom.strength=1.35;
        }
        else if(frame<F_ROTATE){
          overlay.style.opacity='0';
          const p=(frame-F_REVEAL)/(F_ROTATE-F_REVEAL);
          setCubeAlpha(mainCube,1);
          for(let i=0;i<sideCubes.length;i++) setCubeAlpha(sideCubes[i],0);
          mainDisc.material.opacity=0.22+Math.sin(t*1.2)*0.05;
          mainDisc2.material.opacity=0.12;
          topbar.style.opacity=(p*0.95).toFixed(2);
          if(bloom) bloom.strength=1.35;
        }
        else if(frame<F_EXPAND){
          overlay.style.opacity='0';
          const p=easeOut((frame-F_ROTATE)/(F_EXPAND-F_ROTATE));
          setCubeAlpha(mainCube,1);
          topbar.style.opacity=0.95;
          for(let i=0;i<sideCubes.length;i++){
            const lp2=Math.max(0,Math.min(1,(p-i*0.13)/0.55));
            const a=easeOut(lp2);
            setCubeAlpha(sideCubes[i],a);
            sideDiscs[i].material.opacity=a*0.22;
          }
          for(let i=0;i<beams.length;i++){
            const bp=Math.max(0,Math.min(1,(p-0.35-i*0.09)/0.5));
            beams[i].beam.material.opacity=bp*0.85;
            beams[i].halo.material.opacity=bp*0.35;
          }
          flowMat.opacity=p*0.9;
          mainDisc.material.opacity=0.22+Math.sin(t*1.2)*0.05;
          mainDisc2.material.opacity=0.12;
        }
        else if(frame<F_TITLE){
          overlay.style.opacity='0';
          const p=easeOut((frame-F_EXPAND)/(F_TITLE-F_EXPAND));
          setCubeAlpha(mainCube,1);
          for(let i=0;i<sideCubes.length;i++){
            setCubeAlpha(sideCubes[i],1);
            sideDiscs[i].material.opacity=0.22;
          }
          for(let i=0;i<beams.length;i++){beams[i].beam.material.opacity=0.85;beams[i].halo.material.opacity=0.35;}
          flowMat.opacity=0.9;
          titleBlock.style.opacity=p.toFixed(2);
          botbar.style.opacity=(p*0.7).toFixed(2);
          scrollEl.style.opacity=(p*0.7).toFixed(2);
          topbar.style.opacity=0.95;
          mainDisc.material.opacity=0.22+Math.sin(t*1.2)*0.05;
          mainDisc2.material.opacity=0.12;
        }
        else if(frame<F_HOLD){
          overlay.style.opacity='0';
          setCubeAlpha(mainCube,1);
          for(let i=0;i<sideCubes.length;i++){
            setCubeAlpha(sideCubes[i],1);
            sideDiscs[i].material.opacity=0.22;
          }
          for(let i=0;i<beams.length;i++){beams[i].beam.material.opacity=0.85+Math.sin(t*2)*0.08;beams[i].halo.material.opacity=0.35;}
          flowMat.opacity=0.9;
          titleBlock.style.opacity=1;
          botbar.style.opacity=0.7;
          scrollEl.style.opacity=0.7;
          topbar.style.opacity=0.95;
          mainDisc.material.opacity=0.22+Math.sin(t*1.2)*0.05;
          mainDisc2.material.opacity=0.12;
        }
        else{
          const p=easeInOut((frame-F_HOLD)/(F_FADEOUT-F_HOLD));
          overlay.style.opacity=p.toFixed(3);
          const uiFade=Math.max(0,1-p*1.4);
          titleBlock.style.opacity=uiFade.toFixed(2);
          topbar.style.opacity=(uiFade*0.95).toFixed(2);
          botbar.style.opacity=(uiFade*0.7).toFixed(2);
          scrollEl.style.opacity=(uiFade*0.7).toFixed(2);
          setCubeAlpha(mainCube,1);
          for(let i=0;i<sideCubes.length;i++){
            setCubeAlpha(sideCubes[i],1);
            sideDiscs[i].material.opacity=0.22;
          }
        }

        for(let i=0;i<FDOTS;i++){
          const m=flowMeta[i];
          m.t+=0.013; if(m.t>1) m.t-=1;
          const v=new THREE.Vector3().lerpVectors(m.beam.start,m.beam.end,m.t);
          flowPos[i*3]=v.x; flowPos[i*3+1]=v.y; flowPos[i*3+2]=v.z;
        }
        flowGeo.attributes.position.needsUpdate=true;

        kL.intensity=11+Math.sin(t*1.6)*2;
        bL.intensity=3.5+Math.sin(t*2.2)*1;

        const cT=t*0.04;
        camera.position.x=11+Math.sin(cT)*1.6;
        camera.position.y=7+Math.sin(t*0.06)*0.5;
        camera.position.z=14+Math.cos(cT*0.7)*1;
        camera.lookAt(0,0.2,0);

        if(composer) composer.render(); else renderer.render(scene,camera);
      }catch(e){
        const eb=document.getElementById('errbox5');
        if(eb){eb.style.display='block';eb.textContent='loop err: '+(e.message||e);}
      }
    }
    animate();
  }
})();
