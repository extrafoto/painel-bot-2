
document.addEventListener("DOMContentLoaded", function () {
  const senhaCorreta = "1234";
  const modal = document.getElementById("loginModal");
  const senhaInput = document.getElementById("senha");
  const btnEntrar = document.getElementById("btnEntrar");
  const painel = document.getElementById("painel");

  btnEntrar.addEventListener("click", function () {
    if (senhaInput.value.trim() === senhaCorreta) {
      modal.style.display = "none";
      painel.style.display = "block";
    } else {
      alert("Senha incorreta");
    }
  });
});
