
document.documentElement.classList.add("motion-ready");

const revealObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add("visible");
    revealObserver.unobserve(entry.target);
  }
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach((element) => {
  revealObserver.observe(element);
});

const spine = document.querySelector(".spine-line");
if (spine) {
  const horizontal = matchMedia("(max-width: 900px)").matches;
  const hidden = horizontal ? "scaleX(0)" : "scaleY(0)";
  const visible = horizontal ? "scaleX(1)" : "scaleY(1)";

  spine.style.transform = hidden;
  requestAnimationFrame(() => {
    setTimeout(() => {
      spine.style.transform = visible;
    }, 180);
  });
}
