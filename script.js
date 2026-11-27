(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const CATEGORIES = ["Technology","Science","Business","Education","Sports","Creativity","Lifestyle","General"];
  const config = window.INFINITE_SUPABASE_CONFIG || {};
  const configured = config.url && config.anonKey &&
    !config.url.includes("YOUR_SUPABASE") && !config.anonKey.includes("YOUR_SUPABASE");
  const supabaseClient = configured && window.supabase
    ? window.supabase.createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      }) : null;

  let posts = [];
  let ownerPosts = [];
  let activeFilter = "All";
  let editingPost = null;
  let currentCoverUrl = "";
  let selectedCoverFile = null;
  let toastTimer;
  const demoPosts = [
    {id:"demo-1",title:"The Future of Artificial Intelligence",type:"Article",category:"Technology",description:"How intelligent technology is changing the way people live, work and imagine the future.",content:"Artificial intelligence is becoming an important part of modern life. From learning and communication to scientific research, it is opening new possibilities. The future will depend on how thoughtfully people develop and use these technologies.",created_at:"2026-11-01",status:"published"},
    {id:"demo-2",title:"Beyond Our Planet: The Mystery of Space",type:"Magazine",category:"Science",description:"Explore distant galaxies, black holes, stars and the biggest questions about our universe.",content:"Space is filled with questions that continue to inspire scientists. Every discovery gives us another piece of the puzzle and reminds us how much there is still to understand.",created_at:"2026-11-02",status:"published"},
    {id:"demo-3",title:"Think Like an Entrepreneur",type:"Article",category:"Business",description:"A look at problem-solving, creativity and the mindset behind building meaningful ideas.",content:"Entrepreneurship begins with identifying a problem. Great ideas become valuable when they solve real needs. Learning, experimentation and patience are essential parts of building something useful.",created_at:"2026-11-03",status:"published"},
    {id:"demo-4",title:"Learning Beyond the Classroom",type:"Article",category:"Education",description:"Why curiosity, independent learning and asking questions matter.",content:"Education is more than remembering information. It is about understanding, asking questions, testing ideas and applying knowledge to the world around us.",created_at:"2026-11-04",status:"published"},
    {id:"demo-5",title:"The Psychology of Great Sports Performances",type:"Magazine",category:"Sports",description:"Explore focus, preparation, teamwork and decision-making in competitive sport.",content:"Sports performances are shaped by preparation, teamwork and the ability to make decisions under pressure. Consistent practice and learning from experience help athletes develop their skills.",created_at:"2026-11-05",status:"published"},
    {id:"demo-6",title:"The Power of Creative Thinking",type:"Article",category:"Creativity",description:"How imagination can help people see ordinary things in extraordinary ways.",content:"Creativity is not limited to art. It can be used in science, business, education and everyday problem-solving. A new perspective can turn a familiar challenge into an opportunity.",created_at:"2026-11-06",status:"published"},
    {id:"demo-7",title:"Building Better Everyday Habits",type:"Article",category:"Lifestyle",description:"Small routines, thoughtful choices and the value of consistency.",content:"Meaningful progress often comes from small actions repeated over time. A good routine can make space for learning, creativity, rest and personal growth.",created_at:"2026-11-07",status:"published"},
    {id:"demo-8",title:"Robotics: Where Ideas Become Machines",type:"Magazine",category:"Technology",description:"Discover how engineering, programming and imagination come together in robotics.",content:"Robotics combines mechanical design, electronics and software. It is an exciting field because it transforms ideas into machines that can interact with the physical world.",created_at:"2026-11-08",status:"published"},
    {id:"demo-9",title:"The Questions Science Has Yet to Answer",type:"Article",category:"Science",description:"Some of the biggest mysteries that continue to challenge researchers.",content:"Science advances by asking questions and testing explanations. Many mysteries remain, and each new discovery helps researchers understand more about nature and the universe.",created_at:"2026-11-09",status:"published"}
  ];

  function escapeHTML(value="") {
    return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function notify(message) {
    const toast = $("toast"); toast.textContent = message; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
  }
  function dateLabel(value) {
    if (!value) return "Recently published";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Recently published" :
      new Intl.DateTimeFormat(undefined,{day:"numeric",month:"short",year:"numeric"}).format(date);
  }
  function coverMarkup(post, extraClass="") {
    const image = post.cover_url || post.cover || "";
    return `<div class="cover-art ${extraClass}">${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(post.title)} cover" loading="lazy">` : `<span class="cover-placeholder">∞</span>`}</div>`;
  }
  function publicationCard(post, featured=false) {
    return `<article class="${featured?"feature-card":"publication-card"}">
      ${coverMarkup(post)}
      <div class="card-content"><div class="tagline">${escapeHTML(post.type)} · ${escapeHTML(post.category)}</div>
      <h3>${escapeHTML(post.title)}</h3><p>${escapeHTML(post.description || "")}</p>
      <div class="card-meta"><span>By Aashrith G.</span><span>${dateLabel(post.published_at || post.created_at)}</span></div>
      <button class="card-open" type="button" data-read="${escapeHTML(post.id)}">Read publication ↗</button></div></article>`;
  }
  function renderPublications() {
    const term = ($("search").value || "").trim().toLowerCase();
    const visible = posts.filter(p => (activeFilter === "All" || p.category === activeFilter) &&
      [p.title,p.description,p.category,p.type,p.content].join(" ").toLowerCase().includes(term));
    $("publications").innerHTML = visible.length
      ? visible.map(p => publicationCard(p)).join("")
      : `<div class="empty-state">No publications found. Try another category or search term.</div>`;
    const featured = [...posts].slice(0,3);
    $("featuredPublications").innerHTML = featured.length
      ? featured.map((p,i) => publicationCard(p,true)).join("")
      : `<div class="empty-state">New perspectives will appear here soon.</div>`;
    $("statPublications").textContent = posts.length;
    $("statArticles").textContent = posts.filter(p=>p.type==="Article").length;
    $("statMagazines").textContent = posts.filter(p=>p.type==="Magazine").length;
  }
  async function loadPublications() {
    if (!supabaseClient) {
      posts = demoPosts;
      $("sourceNote").textContent = "Preview mode: these are sample publications. Connect Supabase to publish content that is shared with all visitors.";
      $("authMessage").textContent = "Supabase is not configured yet. Follow the setup guide included with this project.";
      $("loginButton").disabled = true;
      $("loginButton").title = "Configure Supabase first";
      renderPublications(); return;
    }
    const {data,error} = await supabaseClient.from("publications")
      .select("id,title,type,category,description,content,cover_url,published_at,created_at,status")
      .eq("status","published").order("published_at",{ascending:false});
    if (error) {
      console.error(error); posts=[]; $("sourceNote").textContent="The publication library could not be loaded. Check your Supabase configuration and database setup.";
      notify("Could not load publications. Please try again later.");
    } else {
      posts = data || []; $("sourceNote").textContent = "";
    }
    renderPublications();
  }
  function openReader(id) {
    const post = posts.find(p=>String(p.id)===String(id));
    if (!post) return;
    const related = posts.filter(p=>p.id!==post.id && p.category===post.category).slice(0,3);
    $("readerBody").innerHTML = `<div class="tagline">${escapeHTML(post.type)} · ${escapeHTML(post.category)}</div>
      <h1 id="readerTitle">${escapeHTML(post.title)}</h1>
      <div class="reader-meta">Written by Aashrith G. &nbsp;·&nbsp; ${dateLabel(post.published_at || post.created_at)}</div>
      ${post.cover_url || post.cover ? `<img class="reader-cover" src="${escapeHTML(post.cover_url || post.cover)}" alt="${escapeHTML(post.title)} cover">` : ""}
      <p class="reader-description">${escapeHTML(post.description || "")}</p>
      <div class="reader-body">${escapeHTML(post.content || "")}</div>
      ${related.length ? `<div class="related"><h3>More from ${escapeHTML(post.category)}</h3>${related.map(p=>`<button type="button" data-related="${escapeHTML(p.id)}">${escapeHTML(p.title)} ↗</button>`).join("")}</div>` : ""}`;
    $("reader").classList.remove("hidden"); document.body.classList.add("modal-open"); $("reader").scrollTop=0;
    $("readingProgress").style.width="0";
  }
  function closeReader() { $("reader").classList.add("hidden"); document.body.classList.remove("modal-open"); $("readingProgress").style.width="0"; }
  function updateReadingProgress() {
    const reader=$("reader"); if(reader.classList.contains("hidden")) return;
    const max=reader.scrollHeight-reader.clientHeight;
    $("readingProgress").style.width=(max>0?(reader.scrollTop/max)*100:0)+"%";
  }

  async function getSession() {
    if (!supabaseClient) return null;
    const {data,error}=await supabaseClient.auth.getSession();
    if(error) console.error(error);
    return data.session;
  }
  async function loadOwnerPosts() {
    if(!supabaseClient) return;
    const {data,error}=await supabaseClient.from("publications")
      .select("*").order("updated_at",{ascending:false});
    if(error){console.error(error);notify("Unable to load your private publications. Check account permissions.");return;}
    ownerPosts=data||[]; renderOwnerPosts();
  }
  function renderOwnerPosts() {
    const published=ownerPosts.filter(p=>p.status==="published").length;
    $("dashTotal").textContent=ownerPosts.length;
    $("dashPublished").textContent=published;
    $("dashDrafts").textContent=ownerPosts.length-published;
    $("myPosts").innerHTML=ownerPosts.length ? ownerPosts.map(p=>`
      <div class="manage-item"><strong>${escapeHTML(p.title)}</strong><small>${escapeHTML(p.type)} · ${escapeHTML(p.category)} · ${p.status==="published"?"Published":"Draft"}</small>
      <div class="manage-actions"><button class="mini-action" data-edit="${escapeHTML(p.id)}">Edit</button>
      <button class="mini-action" data-toggle="${escapeHTML(p.id)}">${p.status==="published"?"Unpublish":"Publish"}</button>
      <button class="mini-action danger" data-delete="${escapeHTML(p.id)}">Delete</button></div></div>`).join("")
      : `<p class="muted">Your library is empty. Create your first publication.</p>`;
  }
  async function showDashboard(session) {
    if(!session){$("loginPanel").classList.remove("hidden");$("editorPanel").classList.add("hidden");return;}
    $("loginPanel").classList.add("hidden");$("editorPanel").classList.remove("hidden");
    await loadOwnerPosts();
  }
  async function login(event) {
    event.preventDefault();
    if(!supabaseClient){notify("Configure Supabase before signing in.");return;}
    const button=$("loginButton");button.disabled=true;button.textContent="Signing in…";
    const {data,error}=await supabaseClient.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
    button.disabled=false;button.textContent="Sign in to Creator Studio ↗";
    if(error){notify(error.message);return;}
    await showDashboard(data.session);notify("Signed in to Creator Studio.");
  }
  async function logout() {
    if(!supabaseClient)return;
    const {error}=await supabaseClient.auth.signOut();
    if(error){notify(error.message);return;}
    ownerPosts=[];resetEditor();await showDashboard(null);notify("You have signed out.");
  }
  function resetEditor() {
    editingPost=null;currentCoverUrl="";selectedCoverFile=null;
    $("publicationForm").reset();$("postId").value="";
    $("editorHeading").textContent="Create a publication";$("editorStatus").textContent="NEW";
    $("publishButton").textContent="Publish now ↗";$("cancelEditButton").classList.add("hidden");
    $("coverPreviewWrap").classList.add("hidden");
  }
  function editPost(id) {
    const post=ownerPosts.find(p=>String(p.id)===String(id));if(!post)return;
    editingPost=post;currentCoverUrl=post.cover_url||"";selectedCoverFile=null;
    $("postId").value=post.id;$("title").value=post.title;$("type").value=post.type;
    $("category").value=post.category;$("description").value=post.description||"";
    $("content").value=post.content;$("editorHeading").textContent="Edit publication";
    $("editorStatus").textContent=post.status.toUpperCase();$("publishButton").textContent="Update & publish ↗";
    $("cancelEditButton").classList.remove("hidden");
    if(currentCoverUrl){$("coverPreview").src=currentCoverUrl;$("coverPreviewWrap").classList.remove("hidden");}
    $("publicationForm").scrollIntoView({behavior:"smooth",block:"start"});
  }
  async function uploadCover(userId) {
    if(!selectedCoverFile) return currentCoverUrl;
    if(!["image/jpeg","image/png","image/webp"].includes(selectedCoverFile.type)) throw new Error("Please use a JPG, PNG or WebP image.");
    if(selectedCoverFile.size>5*1024*1024) throw new Error("Cover images must be 5 MB or smaller.");
    const ext=selectedCoverFile.type==="image/png"?"png":selectedCoverFile.type==="image/webp"?"webp":"jpg";
    const path=`${userId}/${crypto.randomUUID()}.${ext}`;
    const {error}=await supabaseClient.storage.from(config.storageBucket||"publication-covers")
      .upload(path,selectedCoverFile,{cacheControl:"3600",upsert:false,contentType:selectedCoverFile.type});
    if(error)throw error;
    const {data}=supabaseClient.storage.from(config.storageBucket||"publication-covers").getPublicUrl(path);
    return data.publicUrl;
  }
  async function savePublication(status) {
    if(!supabaseClient){notify("Configure Supabase first.");return;}
    const session=await getSession();if(!session){notify("Please sign in again.");await showDashboard(null);return;}
    const title=$("title").value.trim(),description=$("description").value.trim(),content=$("content").value.trim();
    if(!title||!description||!content){notify("Add a title, short description and full content.");return;}
    if(!CATEGORIES.includes($("category").value)){notify("Choose a valid category.");return;}
    const submit=$("publishButton"),draft=$("draftButton");
    submit.disabled=true;draft.disabled=true;submit.textContent="Saving…";
    try{
      const cover_url=await uploadCover(session.user.id);
      const record={title,type:$("type").value,category:$("category").value,description,content,cover_url,status,
        published_at:status==="published"?(editingPost?.published_at||new Date().toISOString()):null,
        updated_at:new Date().toISOString()};
      let result;
      if(editingPost) result=await supabaseClient.from("publications").update(record).eq("id",editingPost.id).select().single();
      else result=await supabaseClient.from("publications").insert({...record,author_id:session.user.id}).select().single();
      if(result.error)throw result.error;
      notify(status==="published"?"Publication is live for all visitors.":"Draft saved privately.");
      resetEditor();await loadOwnerPosts();await loadPublications();
    }catch(error){console.error(error);notify(error.message||"Could not save publication.");}
    finally{submit.disabled=false;draft.disabled=false;submit.textContent=editingPost?"Update & publish ↗":"Publish now ↗";}
  }
  async function togglePublication(id) {
    const post=ownerPosts.find(p=>String(p.id)===String(id));if(!post)return;
    const next=post.status==="published"?"draft":"published";
    const {error}=await supabaseClient.from("publications").update({status:next,published_at:next==="published"?(post.published_at||new Date().toISOString()):null,updated_at:new Date().toISOString()}).eq("id",post.id);
    if(error){notify(error.message);return;}
    notify(next==="published"?"Publication is now public.":"Publication moved to drafts.");
    await loadOwnerPosts();await loadPublications();
  }
  async function deletePublication(id) {
    const post=ownerPosts.find(p=>String(p.id)===String(id));if(!post)return;
    if(!confirm(`Delete "${post.title}" permanently?`))return;
    const {error}=await supabaseClient.from("publications").delete().eq("id",post.id);
    if(error){notify(error.message);return;}
    notify("Publication deleted.");if(editingPost?.id===post.id)resetEditor();
    await loadOwnerPosts();await loadPublications();
  }

  function setupReveals() {
    const elements=document.querySelectorAll(".reveal");
    if(!("IntersectionObserver" in window)){elements.forEach(e=>e.classList.add("visible"));return;}
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add("visible");observer.unobserve(entry.target);}
    }),{threshold:.12});
    elements.forEach(e=>observer.observe(e));
  }
  function setupEvents() {
    $("year").textContent=new Date().getFullYear();
    $("menuToggle").addEventListener("click",()=>{const open=$("mainNav").classList.toggle("open");$("menuToggle").setAttribute("aria-expanded",String(open));});
    $("mainNav").addEventListener("click",e=>{if(e.target.closest("a")){$("mainNav").classList.remove("open");$("menuToggle").setAttribute("aria-expanded","false");}});
    $("search").addEventListener("input",renderPublications);
    $("filters").addEventListener("click",e=>{const btn=e.target.closest("[data-filter]");if(!btn)return;activeFilter=btn.dataset.filter;document.querySelectorAll(".chip").forEach(b=>b.classList.toggle("active",b===btn));renderPublications();});
    document.querySelectorAll("[data-category]").forEach(btn=>btn.addEventListener("click",()=>{activeFilter=btn.dataset.category;document.querySelectorAll(".chip").forEach(b=>b.classList.toggle("active",b.dataset.filter===activeFilter));$("search").value="";renderPublications();$("explore").scrollIntoView({behavior:"smooth"});}));
    $("publications").addEventListener("click",e=>{const b=e.target.closest("[data-read]");if(b)openReader(b.dataset.read);});
    $("featuredPublications").addEventListener("click",e=>{const b=e.target.closest("[data-read]");if(b)openReader(b.dataset.read);});
    $("closeReader").addEventListener("click",closeReader);
    $("reader").addEventListener("click",e=>{if(e.target=== $("reader"))closeReader();const related=e.target.closest("[data-related]");if(related)openReader(related.dataset.related);});
    $("reader").addEventListener("scroll",updateReadingProgress);
    document.addEventListener("keydown",e=>{if(e.key==="Escape")closeReader();if(e.key==="/"&&!["INPUT","TEXTAREA"].includes(document.activeElement.tagName)&&$("reader").classList.contains("hidden")){e.preventDefault();$("search").focus();}});
    $("loginForm").addEventListener("submit",login);$("logoutButton").addEventListener("click",logout);
    $("publicationForm").addEventListener("submit",e=>{e.preventDefault();savePublication("published");});
    $("draftButton").addEventListener("click",()=>savePublication("draft"));
    $("cancelEditButton").addEventListener("click",resetEditor);
    $("coverFile").addEventListener("change",e=>{selectedCoverFile=e.target.files[0]||null;if(selectedCoverFile){$("coverPreview").src=URL.createObjectURL(selectedCoverFile);$("coverPreviewWrap").classList.remove("hidden");}});
    $("removeCover").addEventListener("click",()=>{selectedCoverFile=null;currentCoverUrl="";$("coverFile").value="";$("coverPreviewWrap").classList.add("hidden");});
    $("myPosts").addEventListener("click",e=>{const edit=e.target.closest("[data-edit]"),toggle=e.target.closest("[data-toggle]"),del=e.target.closest("[data-delete]");if(edit)editPost(edit.dataset.edit);if(toggle)togglePublication(toggle.dataset.toggle);if(del)deletePublication(del.dataset.delete);});
  }
  async function init() {
    setupEvents();setupReveals();await loadPublications();
    if(supabaseClient){const session=await getSession();await showDashboard(session);supabaseClient.auth.onAuthStateChange((_event,newSession)=>{setTimeout(()=>showDashboard(newSession),0);});}
    else showDashboard(null);
    setTimeout(()=>$("pageLoader").classList.add("done"),350);
  }
  document.addEventListener("DOMContentLoaded",init);
})();
