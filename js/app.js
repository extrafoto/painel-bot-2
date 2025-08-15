const SHEET_URL = "https://api.sheetbest.com/sheets/ec6ca1f8-de13-4cad-a4b1-1e1919ff5d48";
let contatosGlobais = [];
let intervaloAtualizacao = null;

async function carregarContatos() {
  try {
    const res = await fetch(SHEET_URL);
    const dados = await res.json();
    contatosGlobais = dados;
    atualizarDashboard(dados);
    preencherCidades(dados);
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
  }
}

function preencherCidades(contatos) {
  const select = document.getElementById("filtro-cidade");
  if (!select) return;
  const cidades = [...new Set(contatos.map(c => c.Cidade).filter(Boolean))].sort();
  select.innerHTML = `<option value="">Todas as cidades</option>` + cidades.map(c => `<option value="${c}">${c}</option>`).join("");
}

function atualizarDashboard(contatos) {
  const painel = document.getElementById("painel");
  const totalContatos = document.getElementById("total-contatos");
  const botsAtivos = document.getElementById("bots-ativos");
  const horaAtual = document.getElementById("hora-atual");
  const busca = document.getElementById("busca")?.value.toLowerCase() || "";
  const filtroAtivo = document.querySelector(".filtro.ativo")?.dataset.filtro || "todos";
  const cidadeSelecionada = document.getElementById("filtro-cidade")?.value || "";
  const contatosCidade = document.getElementById("contatos-cidade");

  // Filtrar contatos
  const filtrados = contatos.filter(c => {
    const emBusca = ((c.Nome || "") + (c.numero || "")).toLowerCase().includes(busca);
    const emFiltro = filtroAtivo === "todos" || c.modo === filtroAtivo;
    const emCidade = !cidadeSelecionada || c.Cidade === cidadeSelecionada;
    return emBusca && emFiltro && emCidade;
  });

  // Exibir total de contatos filtrados por cidade
  if (contatosCidade) {
    contatosCidade.textContent = cidadeSelecionada
      ? `Contatos em ${cidadeSelecionada}: ${contatos.filter(c => c.Cidade === cidadeSelecionada).length}`
      : "";
  }

  // Ordenação por data mais recente
  filtrados.sort((a, b) => {
    const parseData = (str) => {
      if (!str || str.toLowerCase() === "nunca") return new Date(0);
      const [data, hora] = str.split(" ");
      const [dia, mes, ano] = data.split("/");
      return new Date(`${ano}-${mes}-${dia}T${hora || "00:00"}`);
    };
    return parseData(b.timestamp_ultima) - parseData(a.timestamp_ultima);
  });

  // Render cards
  painel.innerHTML = "";
  filtrados.forEach(c => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${c.Nome || "Sem Nome"}</h3>
      <small>📱 ${c.numero || "Sem número"}</small><br>
      <div><span>🗺️ ${c.Cidade || "Indefinida"}</span></div>
      <div class="mensagem"><strong>💬 Última mensagem:</strong> ${c.mensagem_ultima || "Sem mensagem"}</div>
      <div class="status ${c.modo === "bot" ? "bot" : "humano"}">
        ${c.modo === "bot" ? "BOT ATIVO" : "BOT DESLIGADO"}
      </div>
      <div><strong>Modo Atual:</strong> ${c.modo === "bot" ? "bot" : "humano"}</div>
      <div><strong>Última Atualização:</strong> ${c.timestamp_ultima || "Nunca"}</div>
      <button class="${c.modo === "bot" ? "desligar" : "ligar"}" onclick="alternarModo('${c.numero}', '${c.modo === "bot" ? "humano" : "bot"}')">
        ${c.modo === "bot" ? "Desligar Bot" : "Ligar Bot"}
      </button>
    `;
    painel.appendChild(card);
  });

  // Totais
  totalContatos.textContent = contatos.length;
  botsAtivos.textContent = contatos.filter(c => c.modo === "bot").length;
  horaAtual.textContent = new Date().toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });

  atualizarGraficoCidades(filtrados);
}

async function alternarModo(numero, novoModo) {
  try {
    const url = `https://api.sheetbest.com/sheets/ec6ca1f8-de13-4cad-a4b1-1e1919ff5d48/numero/${numero}`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ modo: novoModo })
    });
    if (!response.ok) throw new Error("Erro ao atualizar modo");
    // Atualiza a tela após mudança
    carregarContatos();
  } catch (e) {
    alert("Falha ao atualizar o modo do bot!");
    console.error(e);
  }
}

function atualizarGraficoCidades(contatos) {
  const ctx = document.getElementById('grafico-cidades').getContext('2d');
  const dadosCidades = {};
  contatos.forEach(c => {
    if (!c.Cidade) return;
    dadosCidades[c.Cidade] = (dadosCidades[c.Cidade] || 0) + 1;
  });
  const cidades = Object.keys(dadosCidades);
  const quantidades = Object.values(dadosCidades);

  if (window.graficoBarraCidades) {
    window.graficoBarraCidades.data.labels = cidades;
    window.graficoBarraCidades.data.datasets[0].data = quantidades;
    window.graficoBarraCidades.update();
  } else {
    window.graficoBarraCidades = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: cidades,
        datasets: [{
          label: 'Contatos por Cidade',
          data: quantidades,
          backgroundColor: 'rgba(0,123,255,0.6)'
        }]
      },
      options: {
        indexAxis: 'x',
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { beginAtZero: true },
          y: { beginAtZero: true }
        }
      }
    });
  }
}

// Eventos
document.addEventListener("DOMContentLoaded", () => {
  carregarContatos();
  document.getElementById("busca").addEventListener("input", () => atualizarDashboard(contatosGlobais));
  document.getElementById("filtro-cidade").addEventListener("change", () => atualizarDashboard(contatosGlobais));
  document.querySelectorAll(".filtro").forEach(btn =>
    btn.addEventListener("click", function () {
      document.querySelectorAll(".filtro").forEach(b => b.classList.remove("ativo"));
      this.classList.add("ativo");
      atualizarDashboard(contatosGlobais);
    })
  );

  // Atualização automática a cada 15 minutos
  intervaloAtualizacao = setInterval(() => carregarContatos(), 15 * 60 * 1000);
});
