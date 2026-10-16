document.documentElement.classList.add("motion-ready");
const observer = new IntersectionObserver((entries)=>{
  entries.forEach((entry)=>{
    if(entry.isIntersecting){
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
},{threshold:.14});
document.querySelectorAll(".reveal").forEach((el)=>observer.observe(el));

const weaveObserver = new IntersectionObserver((entries)=>{
  entries.forEach((entry)=>{
    if(!entry.isIntersecting) return;
    const card=entry.target;
    card.classList.add("is-active");
    window.setTimeout(()=>card.classList.remove("is-active"),1100);
    weaveObserver.unobserve(card);
  });
},{threshold:.5});
document.querySelectorAll(".project-card").forEach((card,i)=>{
  window.setTimeout(()=>weaveObserver.observe(card),i*180);
});
