document.addEventListener("touchstart", function () {}, false);

let mybutton = document.getElementById("topBtn");

window.onscroll = function () {
  scrollFunction();
};

function scrollFunction() {
  if (!mybutton) {
    mybutton = document.getElementById("topBtn"); // Recheck if the button exists
    if (!mybutton) return; // Exit if still not found
  }

  if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
    mybutton.style.display = "block";
  } else {
    mybutton.style.display = "none";
  }
}

function topFunction() {
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
}
