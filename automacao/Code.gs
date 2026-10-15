/**
 * Automação de correção de listas do PETI — Google Forms
 * ------------------------------------------------------
 * Instalar: abra o formulário no modo edição > ⋮ (canto superior direito) >
 * "Editor de script" > apague o conteúdo e cole este arquivo > salvar.
 *
 * Funções (rodar pelo menu "Executar" do editor, ou pelo menu "PETI" que
 * aparece dentro da planilha de respostas depois de rodar 'instalarMenu'):
 *
 *   exportarEnvios()  -> cria/atualiza a aba "Envios" na planilha de respostas
 *                        com: responseId, email, nome, problema, fileId,
 *                        nomeDoArquivo, link, notaAtual. Serve de "gabarito"
 *                        de quem mandou o quê (evita confundir arquivo com
 *                        nome de responsável).
 *
 *   copiarEnvios()    -> copia os arquivos enviados para a pasta do Drive
 *                        "PETI Envios/<lista>/P<N>/<email>__<k>.<ext>" (+ mapa.csv).
 *                        Com o Google Drive para Desktop, eles aparecem em
 *                        G:\Meu Drive\PETI Envios\... e o Claude lê de lá,
 *                        sem baixar nada pelo navegador.
 *
 *   importarNotas()   -> lê a aba "Notas" (colunas: email | nome | problema | nota |
 *                        feedback) e grava as notas + feedback individual no
 *                        formulário. NÃO libera a pontuação para os alunos —
 *                        isso continua manual (botão "Liberar pontuação").
 *
 *   importarNotasDeCSV() -> pega o CSV mais recente da pasta "PETI Notas" do
 *                        Drive (o Claude deixa lá), copia para a aba "Notas",
 *                        pede confirmação e grava no formulário.
 *
 *   criarAbaNotas()   -> cria a aba "Notas" vazia com o cabeçalho certo.
 */

var NOME_ABA_ENVIOS = 'Envios';
var NOME_ABA_NOTAS  = 'Notas';
var TITULO_ITEM_NOME = 'Nome Completo';   // título da pergunta com o nome do aluno

// ---------------------------------------------------------------- utilidades

// Descobre o formulário de 3 jeitos: (1) rodando de dentro do formulário,
// (2) rodando de dentro da planilha de respostas (menu PETI), (3) pelo id
// guardado quando 'instalarMenu' rodou.
function getForm_() {
  var form = FormApp.getActiveForm();
  if (form) return form;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    var url = ss.getFormUrl();
    if (url) return FormApp.openByUrl(url);
    // planilha com várias abas de respostas: tenta a aba ativa e as demais
    var abas = [ss.getActiveSheet()].concat(ss.getSheets());
    for (var i = 0; i < abas.length; i++) {
      var u = abas[i].getFormUrl();
      if (u) return FormApp.openByUrl(u);
    }
  }

  var id = PropertiesService.getScriptProperties().getProperty('FORM_ID');
  if (id) return FormApp.openById(id);

  throw new Error('Não achei o formulário. Abra o Apps Script pelo formulário (⋮ > Editor de script) e rode instalarMenu uma vez.');
}

function getPlanilha_() {
  var ativa = SpreadsheetApp.getActiveSpreadsheet();
  if (ativa) return ativa;                       // rodando pelo menu da planilha
  var form = getForm_();
  var destId = null;
  try { destId = form.getDestinationId(); } catch (e) { destId = null; }
  if (destId) return SpreadsheetApp.openById(destId);
  // Sem planilha vinculada: cria uma e vincula.
  var ss = SpreadsheetApp.create('Respostas - ' + form.getTitle());
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  return ss;
}

function getOuCriarAba_(ss, nome, cabecalho) {
  var aba = ss.getSheetByName(nome);
  if (!aba) {
    aba = ss.insertSheet(nome);
    aba.appendRow(cabecalho);
    aba.setFrozenRows(1);
  }
  return aba;
}

// marcas de acento (U+0300..U+036F), montadas sem escapes para sobreviver a copia/cola
var ACENTOS_RE = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');

// minúsculas, sem acentos, espaços comprimidos — para comparar e-mails/nomes
function normaliza_(s) {
  return String(s || '').trim().toLowerCase()
    .normalize('NFD').replace(ACENTOS_RE, '')
    .replace(/\s+/g, ' ');
}

// Mapas email -> FormResponse e nome -> FormResponse
// (fica a ÚLTIMA resposta de cada aluno).
function indicesDeRespostas_(form) {
  var porEmail = {}, porNome = {  };
  form.getResponses().forEach(function (r) {
    var email = normaliza_(r.getRespondentEmail());
    if (email) porEmail[email] = r;
    var nome = normaliza_(nomeDoAluno_(r));
    if (nome) porNome[nome] = r;
  });
  return { porEmail: porEmail, porNome: porNome };
}

function nomeDoAluno_(resposta) {
  var itens = resposta.getItemResponses();
  for (var i = 0; i < itens.length; i++) {
    if (itens[i].getItem().getTitle() === TITULO_ITEM_NOME) return String(itens[i].getResponse());
  }
  return '';
}

// ------------------------------------------------------------ exportarEnvios

// Acha a aba de respostas do formulário dentro da planilha (a que tem getFormUrl).
function abaDeRespostas_(ss) {
  var abas = ss.getSheets();
  for (var i = 0; i < abas.length; i++) if (abas[i].getFormUrl()) return abas[i];
  for (var j = 0; j < abas.length; j++) if (/^Form[_ ]Responses/i.test(abas[j].getName())) return abas[j];
  throw new Error('Não achei a aba de respostas do formulário nesta planilha.');
}

// Extrai ids de arquivos do Drive de uma célula com um ou mais links.
function idsDaCelula_(texto) {
  var ids = [], re = /[?&]id=([\w-]+)|\/d\/([\w-]+)/g, m;
  texto = String(texto || '');
  while ((m = re.exec(texto)) !== null) ids.push(m[1] || m[2]);
  return ids;
}

function exportarEnvios() {
  var form = getForm_();
  var ss = getPlanilha_();
  var cab = ['responseId', 'email', 'nome', 'problema', 'fileId', 'nomeDoArquivo', 'link', 'notaAtual'];
  var aba = getOuCriarAba_(ss, NOME_ABA_ENVIOS, cab);
  aba.clearContents();
  aba.appendRow(cab);

  // Notas atuais e responseId por e-mail (via FormApp; getScore funciona bem).
  var info = {};   // email -> { id, notas: {tituloNormalizado: nota} }
  form.getResponses().forEach(function (r) {
    var email = normaliza_(r.getRespondentEmail());
    var notas = {};
    try {
      r.getGradableItemResponses().forEach(function (ir) {
        try { notas[normaliza_(ir.getItem().getTitle())] = ir.getScore(); } catch (e) {}
      });
    } catch (e) {}
    info[email] = { id: r.getId(), notas: notas };
  });

  // Arquivos: lidos da aba de respostas da planilha (uma coluna por problema).
  var resp = abaDeRespostas_(ss);
  var dados = resp.getDataRange().getValues();
  var cabec = dados.shift().map(String);
  var cEmail = -1, cNome = -1, colsProb = [];
  cabec.forEach(function (t, i) {
    var n = normaliza_(t);
    if (n === 'email address' || n === 'endereco de e-mail' || n === 'e-mail' || n === 'email') cEmail = i;
    else if (t === TITULO_ITEM_NOME) cNome = i;
    else if (/^problema\b/i.test(t)) colsProb.push(i);
  });
  if (cEmail < 0) throw new Error('Não achei a coluna de e-mail na aba ' + resp.getName());

  // Se um aluno respondeu mais de uma vez, vale a última linha dele.
  var ultima = {};
  dados.forEach(function (linha, i) { var e = normaliza_(linha[cEmail]); if (e) ultima[e] = i; });

  var linhas = [];
  Object.keys(ultima).forEach(function (email) {
    var linha = dados[ultima[email]];
    var nome = cNome >= 0 ? String(linha[cNome]) : '';
    var inf = info[email] || { id: '', notas: {} };
    colsProb.forEach(function (c) {
      var titulo = cabec[c];
      var nota = inf.notas[normaliza_(titulo)];
      if (nota === undefined) nota = '';
      var ids = idsDaCelula_(linha[c]);
      if (ids.length === 0) {
        linhas.push([inf.id, email, nome, titulo, '', '(sem arquivo)', '', nota]);
        return;
      }
      ids.forEach(function (id) {
        var nomeArq = '', link = 'https://drive.google.com/file/d/' + id + '/view';
        try { nomeArq = DriveApp.getFileById(id).getName(); }
        catch (e) { nomeArq = '(sem acesso: ' + id + ')'; }
        linhas.push([inf.id, email, nome, titulo, id, nomeArq, link, nota]);
      });
    });
  });

  if (linhas.length) aba.getRange(2, 1, linhas.length, cab.length).setValues(linhas);
  aba.autoResizeColumns(1, cab.length);
  SpreadsheetApp.flush();
  Logger.log('Exportadas ' + linhas.length + ' linhas para a aba "' + NOME_ABA_ENVIOS + '".');
}

// ------------------------------------------------------------ copiarEnvios

var NOME_PASTA_ENVIOS = 'PETI Envios';  // pasta no Drive; o Drive para Desktop sincroniza para G:\Meu Drive\PETI Envios

function subpasta_(pai, nome) {
  var it = pai.getFoldersByName(nome);
  return it.hasNext() ? it.next() : pai.createFolder(nome);
}

// Copia os arquivos enviados no formulário para
//   PETI Envios/<lista>/P<N>/<email>__<k>.<ext>
// e grava PETI Envios/<lista>/mapa.csv (email,nome,problema,arquivo).
// <lista> = título do formulário (só letras, números, - e _).
// É idempotente: arquivo que já existe com o mesmo nome não é copiado de novo,
// então pode rodar quantas vezes quiser (ex.: depois de novos envios). Se
// passar de 4 min (limite do Apps Script é 6), para e avisa para rodar de novo.
function copiarEnvios() {
  var inicio = Date.now();
  exportarEnvios();                      // garante a aba Envios atualizada
  var form = getForm_();
  var ss = getPlanilha_();
  var aba = ss.getSheetByName(NOME_ABA_ENVIOS);
  var dados = aba.getDataRange().getValues();
  var cab = dados.shift().map(String);
  var col = {};
  cab.forEach(function (t, i) { col[t] = i; });

  var lista = form.getTitle().normalize('NFD').replace(ACENTOS_RE, '')
    .replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'lista';
  var raiz = subpasta_(DriveApp.getRootFolder(), NOME_PASTA_ENVIOS);
  var pastaLista = subpasta_(raiz, lista);
  var pastasProb = {};

  var contador = {};   // email|problema -> k
  var mapa = [['email', 'nome', 'problema', 'arquivo']];
  var copiados = 0, pulados = 0, semAcesso = 0, incompleto = false;

  for (var i = 0; i < dados.length; i++) {
    var l = dados[i];
    var email = String(l[col.email]), nome = String(l[col.nome]);
    var problema = String(l[col.problema]), fileId = String(l[col.fileId]);
    if (!fileId) { mapa.push([email, nome, problema, '']); continue; }

    var m = /(\d+)/.exec(problema);
    var pastaNome = m ? 'P' + m[1] : problema.replace(/[^\w-]+/g, '_');
    if (!pastasProb[pastaNome]) pastasProb[pastaNome] = subpasta_(pastaLista, pastaNome);
    var pasta = pastasProb[pastaNome];

    var chave = email + '|' + pastaNome;
    contador[chave] = (contador[chave] || 0) + 1;

    var orig;
    try { orig = DriveApp.getFileById(fileId); }
    catch (e) { semAcesso++; mapa.push([email, nome, problema, '(sem acesso: ' + fileId + ')']); continue; }
    var mext = /\.([A-Za-z0-9]+)$/.exec(orig.getName());
    var ext = mext ? mext[1].toLowerCase()
      : ({ 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic' }[orig.getMimeType()] || 'bin');
    var novoNome = email + '__' + contador[chave] + '.' + ext;
    mapa.push([email, nome, problema, pastaNome + '/' + novoNome]);

    if (pasta.getFilesByName(novoNome).hasNext()) { pulados++; continue; }
    if (Date.now() - inicio > 4 * 60 * 1000) { incompleto = true; continue; }
    orig.makeCopy(novoNome, pasta);
    copiados++;
  }

  // mapa.csv (sobrescreve)
  var csv = mapa.map(function (r) {
    return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
  }).join('\n');
  var antigos = pastaLista.getFilesByName('mapa.csv');
  while (antigos.hasNext()) antigos.next().setTrashed(true);
  pastaLista.createFile('mapa.csv', csv, MimeType.CSV);

  var msg = 'Pasta: ' + NOME_PASTA_ENVIOS + '/' + lista + '\n' +
    'Copiados: ' + copiados + ' | já existiam: ' + pulados + ' | sem acesso: ' + semAcesso +
    (incompleto ? '\n\nTEMPO ESGOTADO: rode "Copiar envios" de novo para continuar.' : '');
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert('Copiar envios', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
}

// ------------------------------------------------------------- criarAbaNotas

function criarAbaNotas() {
  var ss = getPlanilha_();
  getOuCriarAba_(ss, NOME_ABA_NOTAS, ['email', 'nome', 'problema', 'nota', 'feedback']);
  Logger.log('Aba "' + NOME_ABA_NOTAS + '" pronta.');
}

// ------------------------------------------------------------- importarNotas

function importarNotas() {
  var form = getForm_();
  var ss = getPlanilha_();
  var aba = ss.getSheetByName(NOME_ABA_NOTAS);
  if (!aba) throw new Error('Aba "' + NOME_ABA_NOTAS + '" não existe. Rode criarAbaNotas() e preencha.');

  var dados = aba.getDataRange().getValues();
  var cab = dados.shift().map(normaliza_);
  var cEmail = cab.indexOf('email'), cNome = cab.indexOf('nome'),
      cProb = cab.indexOf('problema'), cNota = cab.indexOf('nota'),
      cFb = cab.indexOf('feedback');
  if ((cEmail < 0 && cNome < 0) || cProb < 0 || cNota < 0) {
    throw new Error('Cabeçalho da aba Notas deve conter: email (ou nome), problema, nota (e opcionalmente feedback).');
  }

  // Itens do formulário por título (ex.: "Problema 1").
  var itensPorTitulo = {};
  form.getItems().forEach(function (it) { itensPorTitulo[normaliza_(it.getTitle())] = it; });

  var idx = indicesDeRespostas_(form);
  var alteradas = {};   // responseId -> FormResponse
  var erros = [];

  dados.forEach(function (linha, i) {
    var email = cEmail >= 0 ? normaliza_(linha[cEmail]) : '';
    var nome = cNome >= 0 ? normaliza_(linha[cNome]) : '';
    var prob = normaliza_(linha[cProb]);
    var nota = linha[cNota];
    var fb = cFb >= 0 ? String(linha[cFb] || '') : '';
    if (!email && !nome && !prob && nota === '') return;      // linha vazia
    if (nota === '' || nota === null || isNaN(Number(nota))) {
      erros.push('Linha ' + (i + 2) + ': nota inválida "' + nota + '"'); return;
    }
    // e-mail tem prioridade; se não houver/achar, tenta pelo nome
    var r = (email && idx.porEmail[email]) || (nome && idx.porNome[nome]) || null;
    if (!r) { erros.push('Linha ' + (i + 2) + ': aluno não encontrado (email "' + email + '", nome "' + nome + '")'); return; }
    var item = itensPorTitulo[prob];
    if (!item) { erros.push('Linha ' + (i + 2) + ': problema não encontrado "' + prob + '"'); return; }

    var ir = null;
    try { ir = r.getGradableResponseForItem(item); } catch (e) { ir = null; }
    if (!ir) {   // fallback: procura na lista de respostas graduáveis
      try {
        var lista = r.getGradableItemResponses();
        for (var k = 0; k < lista.length; k++) {
          if (lista[k].getItem().getId() === item.getId()) { ir = lista[k]; break; }
        }
      } catch (e) {}
    }
    if (!ir) { erros.push('Linha ' + (i + 2) + ': ' + (email || nome) + ' não tem resposta para ' + prob); return; }
    ir.setScore(Number(nota));
    if (fb) ir.setFeedback(FormApp.createFeedback().setText(fb).build());
    r.withItemGrade(ir);
    alteradas[r.getId()] = r;
  });

  var lista = Object.keys(alteradas).map(function (k) { return alteradas[k]; });
  if (lista.length) form.submitGrades(lista);

  Logger.log('Notas gravadas em ' + lista.length + ' respostas.');
  if (erros.length) Logger.log('AVISOS:\n' + erros.join('\n'));
  try {
    SpreadsheetApp.getUi().alert('Notas gravadas em ' + lista.length + ' respostas.' +
      (erros.length ? '\n\nAvisos:\n' + erros.join('\n') : ''));
  } catch (e) { /* sem UI (rodou pelo editor) */ }
}

// ------------------------------------------------------ importarNotasDeCSV

var NOME_PASTA_NOTAS = 'PETI Notas';   // pasta no Drive onde o Claude deixa os CSVs

function pastaNotas_() {
  var it = DriveApp.getFoldersByName(NOME_PASTA_NOTAS);
  return it.hasNext() ? it.next() : DriveApp.createFolder(NOME_PASTA_NOTAS);
}

// Pega o CSV mais recente da pasta "PETI Notas", copia para a aba Notas e
// grava no formulário. Pede confirmação mostrando o nome do arquivo.
function importarNotasDeCSV() {
  var pasta = pastaNotas_();
  var arquivos = pasta.getFiles(), melhor = null;
  while (arquivos.hasNext()) {
    var f = arquivos.next();
    if (!/\.(csv|tsv|txt)$/i.test(f.getName())) continue;
    if (!melhor || f.getLastUpdated() > melhor.getLastUpdated()) melhor = f;
  }
  if (!melhor) throw new Error('Nenhum CSV na pasta "' + NOME_PASTA_NOTAS + '" do Drive.');

  var ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  if (ui) {
    var resp = ui.alert('Importar notas',
      'Arquivo mais recente: ' + melhor.getName() + '\n(' + melhor.getLastUpdated() + ')\n\n' +
      'Gravar essas notas neste formulário?', ui.ButtonSet.YES_NO);
    if (resp !== ui.Button.YES) return;
  }

  var texto = melhor.getBlob().getDataAsString('UTF-8');
  var sep = /\.tsv$/i.test(melhor.getName()) || texto.indexOf('\t') >= 0 ? '\t' : ',';
  var dados = Utilities.parseCsv(texto, sep).filter(function (l) { return l.join('').trim() !== ''; });
  if (dados.length < 2) throw new Error('CSV vazio: ' + melhor.getName());

  var ss = getPlanilha_();
  var aba = getOuCriarAba_(ss, NOME_ABA_NOTAS, dados[0]);
  aba.clearContents();
  aba.getRange(1, 1, dados.length, dados[0].length).setValues(dados);
  SpreadsheetApp.flush();

  importarNotas();
  // marca o arquivo como usado, para não importar de novo sem querer
  melhor.setName(melhor.getName().replace(/^(?!importado_)/, 'importado_'));
}

// ------------------------------------------------------------- menu opcional

// Rode uma vez pelo editor; depois abra a planilha de respostas: aparece o menu "PETI".
function instalarMenu() {
  var form = getForm_();
  PropertiesService.getScriptProperties().setProperty('FORM_ID', form.getId());
  var ss = getPlanilha_();
  // evita duplicar o gatilho se rodar duas vezes
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onOpenPlanilha_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onOpenPlanilha_').forSpreadsheet(ss).onOpen().create();
  Logger.log('Menu instalado. Abra (ou recarregue) a planilha: ' + ss.getUrl());
}

function onOpenPlanilha_() {
  SpreadsheetApp.getUi().createMenu('PETI')
    .addItem('1) Exportar envios', 'exportarEnvios')
    .addItem('1b) Copiar envios para o Drive (pasta "PETI Envios")', 'copiarEnvios')
    .addItem('2) Importar notas do CSV (pasta "PETI Notas" no Drive)', 'importarNotasDeCSV')
    .addSeparator()
    .addItem('Criar aba Notas (para preencher à mão)', 'criarAbaNotas')
    .addItem('Importar notas da aba Notas', 'importarNotas')
    .addToUi();
}
