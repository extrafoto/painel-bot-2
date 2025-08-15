/*******************************
 * Painel Bot WhatsApp (Postgres)
 * Integração n8n:
 *  - LISTA (POST): https://services-n8n.8a8cte.easypanel.host/webhook-test/88a25f2b-0085-4a86-81e0-4bbd3a8eb714
 *  - TOGGLE (PUT): https://services-n8n.8a8cte.easypanel.host/webhook-test/55f6af41-b89e-46f1-98b1-5bcfb0a599a4
 *******************************/

const LIST_URL   = "https://services-n8n.8a8cte.easypanel.host/webhook-test/88a25f2b-0085-4a86-81e0-4bbd3a8eb714"; // POST
const TOGGLE_URL = "https://services-n8n.8a8cte.easypanel.host/webhook-test/55f6af41-b89e-46f1-98b1-5bcfb0a599a4"; // PUT (toggle)

let contatosGlobais = [];
let intervaloAtualizacao = null;

/* ===========================
   Utilidades
=========================== */
function normalizarModo(valor) {
  // Aceita boolean, "bot"/"humano", "true"/"false", "1"/"0"
  if (typeof valor === "boolean") return valor ? "bot" : "humano";
  const v = String(valor ?? "").trim().toLowerCase();
  if (v === "bot" || v === "true" || v === "1") return "bot";
  return "humano";
}

function parseTimestampFlex(ts) {
  // Aceita "dd/mm/yyyy HH:MM", "yyyy-mm-dd HH:MM:SS", ISO etc.
  if (!ts || typeof ts !== "string") return new Date(0);

  const s = ts.trim();

  // dd/mm/yyyy HH:MM
  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m1) {
    const [ , dd, mm, yyyy, HH="00", MM="00", SS="00"] = m1;
    return new Date(`${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}`);
  }

  // yyyy-mm-dd HH:MM(:SS)?
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m2) {
    const [ , yyyy, mm, dd, HH="00", MM="00", SS="00"] = m2;
    return new Date(`${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}`);
  }

  // Fallback: deixar o Date tentar
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;

  return new Date(0);
}

function formatarDataBR(date) {
  try {
    return date.toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  } catch {
    return "";
  }
}

/* ===========================
   Carregar contatos (POST n8n)
=========================== */
async function carregarContatos() {
  try {
    const res = await fetch(LIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}) // se o flow exigir algum filtro, enviar aqui
    });

    if (!res.ok) throw new Error(`Falha ao buscar contatos (HTTP ${res.status})`);
    const dados = await res.json();

    // Normaliza campos esperados pela UI
    // Esperado: sessionId, numero, Nome, Cidade, mensagem_ultima, modo, timestamp_ultima
    contatosGlobais = (Array.isArray(dados) ? dados : []).map((c) => {
      const modo = normalizarModo(c.modo);
      const ts = c.timestamp_ultima || c.timestamp || c.updated_at || c.data || "";
      return {
        sessionId: c.sessionId || c.sessionid || c.session_id || "",
        numero: c.numero || c.phone || c.whatsapp || "",
        Nome: c.Nome || c.nome || c.name || "",
        Cidade: c.Cidade || c.cidade || "",
        mensagem_ultima: c.mensagem_ultima || c.mensagem || c.ultima_mensagem || "",
        modo,
        timestamp_ultima: ts
      };
    });

    atualizarDashboard(contatosGlobais);
    preencherCidades(contatosGlobais);
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    // Pode exibir um toast/erro na UI se desejar
  }
}

/* ===========================
   Alternar modo (PUT n8n)
=========================== */
async function alternarModo(chave) {
  // Preferimos sessionId; se vier numero, o fluxo do n8n precisa aceitar também
  const payload = [{}];
  if (String(chave || "").startsWith("55") || String(chave || "").replace(/\D/g, "").length >= 11) {
    // heurística: parece um número de telefone
    payload[0].numero = chave;
  } else {
    payload[0].sessionId = chave;
  }

  try {
    const response = await fetch(TOGGLE_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload) // fluxo lê body[0].sessionId ou body[0].numero
    });

    if (!response.ok) throw new Error(`Erro ao alternar modo (HTTP ${response.status})`);

    // Recarrega os dados para refletir o novo estado
    await carregarContatos();
  } catch (e) {
    alert("Falha ao atualizar o modo do bot!");
    console.error(e);
  }
}

/* ===========================
   Render / Dashboard
=========================== */
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

  // Exibir total de contatos da cidade selecionada
  if (contatosCidade) {
    contatosCidade.textContent = cidadeSelecionada
      ? `Contatos em ${cidadeSelecionada}: ${contatos.filter(c => c.Cidade === cidadeSelecionada).length}`
      : "";
  }

  // Ordenar do mais recente para o mais antigo
  filtrados.sort((a, b) => {
    const da = parseTimestampFlex(a.timestamp_ultima);
    const db = parseTimestampFlex(b.timestamp_ultima);
    return db - da;
  });

  // Render cards
  painel.innerHTML = "";
  filtrados.forEach(c => {
    const chave = c.sessionId || c.numero || "";
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
      <div><strong>Modo Atual:</strong> ${c.modo}</div>
      <div><strong>Última Atualização:</strong> ${c.timestamp_ultima ? formatarDataBR(parseTimestampFlex(c.timestamp_ultima)) : "Nunca"}</div>
      <button class="${c.modo === "bot" ? "desligar" : "ligar"}"
              onclick="alternarModo('${chave}')">
        ${c.modo === "bot" ? "Desligar Bot" : "Ligar Bot"}
      </button>
    `;
    painel.appendChild(card);
  });

  // Totais
  totalContatos.textContent = contatos.length;
  botsAtivos.textContent = contatos.filter(c => c.modo === "bot").length;
  horaAtual.textContent = formatarDataBR(new Date());

  atualizarGraficoCidades(filtrados);
}

/* ===========================
   Cidades (select) e gráfico
=========================== */
function preencherCidades(contatos) {
  const select = document.getElementById("filtro-cidade");
  if (!select) return;

  const cidades = [...new Set(contatos.map(c => c.Cidade).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );

  // Mantém a opção "Todas"
  const atual = select.value || "";
  select.innerHTML = `<option value="">Todas</option>` + cidades.map(c => `<option value="${c}">${c}</option>`).join("");
  if (cidades.includes(atual)) select.value = atual;
}

function atualizarGraficoCidades(contatos) {
  const canvas = document.getElementById("graficoCidades");
  if (!canvas || typeof Chart === "undefined") return;

  const ctx = canvas.getContext("2d");
  const dadosCidades = {};
  contatos.forEach(c => {
    if (!c.Cidade) return;
    dadosCidades[c.Cidade] = (dadosCidades[c.Cidade] || 0) + 1;
  });

  const labels = Object.keys(dadosCidades);
  const valores = Object.values(dadosCidades);

  if (window.graficoBarraCidades) {
    window.graficoBarraCidades.data.labels = labels;
    window.graficoBarraCidades.data.datasets[0].data = valores;
    window.graficoBarraCidades.update();
  } else {
    window.graficoBarraCidades = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Contatos por cidade',
          data: valores
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { autoSkip: true, maxRotation: 45, minRotation: 0 } },
          y: { beginAtZero: true, precision: 0 }
        }
      }
    });
  }
}

/* ===========================
   Eventos
=========================== */
document.addEventListener("DOMContentLoaded", () => {
  carregarContatos();

  const buscaEl = document.getElementById("busca");
  if (buscaEl) buscaEl.addEventListener("input", () => atualizarDashboard(contatosGlobais));

  const filtroCidadeEl = document.getElementById("filtro-cidade");
  if (filtroCidadeEl) filtroCidadeEl.addEventListener("change", () => atualizarDashboard(contatosGlobais));

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
