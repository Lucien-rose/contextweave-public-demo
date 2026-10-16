document.documentElement.classList.add("motion-ready");
const revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("visible");revealObserver.unobserve(entry.target)}}),{threshold:.12});
document.querySelectorAll(".reveal").forEach(el=>revealObserver.observe(el));
const spine=document.querySelector(".spine-line");
if(spine){
  const mobile=window.matchMedia("(max-width:900px)").matches;
  spine.style.transform=mobile?"scaleX(0)":"scaleY(0)";
  requestAnimationFrame(()=>setTimeout(()=>spine.style.transform=mobile?"scaleX(1)":"scaleY(1)",180));
}
