export const DEFAULT_TEMPLATES = [
  {
    name: "Contrato de Trabalho CLT",
    description: "Contrato padrão CLT com todos os dados do funcionário",
    category: "contrato",
    html_content: `
<div style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.7;color:#111;max-width:800px;margin:0 auto">

  <!-- Cabeçalho com logo -->
  <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px">
    <div style="margin-bottom:10px">{{company.logo}}</div>
    <h1 style="font-size:15pt;font-weight:bold;margin:0;letter-spacing:1px">CONTRATO INDIVIDUAL DE TRABALHO</h1>
    <p style="margin:4px 0 0;font-size:9pt;color:#555">Regime CLT – Consolidação das Leis do Trabalho</p>
  </div>

  <!-- Dados da empresa -->
  <div style="background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:14px 16px;margin-bottom:18px">
    <p style="font-size:9pt;font-weight:bold;margin:0 0 8px;text-transform:uppercase;color:#444;border-bottom:1px solid #ccc;padding-bottom:4px">EMPREGADOR (CONTRATANTE)</p>
    <p style="margin:3px 0"><strong>Empresa:</strong> {{company.name}}</p>
    <p style="margin:3px 0"><strong>CNPJ:</strong> {{company.cnpj}}</p>
    <p style="margin:3px 0"><strong>Endereço:</strong> {{company.address}}</p>
  </div>

  <!-- Dados do funcionário -->
  <div style="background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:14px 16px;margin-bottom:18px">
    <p style="font-size:9pt;font-weight:bold;margin:0 0 8px;text-transform:uppercase;color:#444;border-bottom:1px solid #ccc;padding-bottom:4px">EMPREGADO (CONTRATADO)</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 24px">
      <p style="margin:3px 0"><strong>Nome:</strong> {{employee.full_name}}</p>
      <p style="margin:3px 0"><strong>CPF:</strong> {{employee.cpf}}</p>
      <p style="margin:3px 0"><strong>RG:</strong> {{employee.rg}} — {{employee.rg_issuer}}/{{employee.rg_issuer_state}}</p>
      <p style="margin:3px 0"><strong>Nascimento:</strong> {{employee.birth_date}}</p>
      <p style="margin:3px 0"><strong>Nacionalidade:</strong> {{employee.nationality_country}}</p>
      <p style="margin:3px 0"><strong>Estado Civil:</strong> {{employee.marital_status}}</p>
      <p style="margin:3px 0"><strong>PIS/PASEP:</strong> {{employee.pis_number}}</p>
      <p style="margin:3px 0"><strong>CTPS:</strong> {{employee.ctps_number}} — Série: {{employee.ctps_series}}/{{employee.ctps_state}}</p>
      <p style="margin:3px 0;grid-column:1/-1"><strong>Endereço:</strong> {{employee.address_street}}, {{employee.address_number}}, {{employee.address_neighborhood}} — {{employee.address_city}}/{{employee.address_state}} — CEP: {{employee.address_zipcode}}</p>
    </div>
  </div>

  <!-- Cláusulas -->
  <h2 style="font-size:12pt;border-bottom:1px solid #ccc;padding-bottom:6px;margin-bottom:12px">CLÁUSULAS DO CONTRATO</h2>

  <p><strong>CLÁUSULA 1ª – DO OBJETO:</strong> O(A) CONTRATADO(A) é admitido(a) na função de <strong>{{employee.job_function}}</strong>, CBO <strong>{{employee.cbo}}</strong>, na empresa <strong>{{company.name}}</strong>, a partir de <strong>{{employee.hire_date}}</strong>.</p>

  <p><strong>CLÁUSULA 2ª – DA REMUNERAÇÃO:</strong> O(A) CONTRATADO(A) receberá remuneração mensal de <strong>{{employee.salary}}</strong>, a ser pago até o 5º dia útil do mês subsequente, nos termos do Art. 459, §1º da CLT.</p>

  <p><strong>CLÁUSULA 3ª – DA JORNADA:</strong> A jornada de trabalho será de 44 (quarenta e quatro) horas semanais, distribuídas de segunda a sexta-feira, das <strong>{{company.work_start_time}}</strong> às <strong>{{company.work_end_time}}</strong>, com intervalo de 1 hora para refeição, conforme Art. 71 da CLT.</p>

  <p><strong>CLÁUSULA 4ª – DO LOCAL:</strong> As atividades serão desenvolvidas no endereço indicado pela empresa, podendo ser alterado mediante prévia comunicação.</p>

  <p><strong>CLÁUSULA 5ª – DAS OBRIGAÇÕES DO EMPREGADO:</strong> O(A) empregado(a) obriga-se a cumprir as normas internas da empresa, guardar sigilo de informações confidenciais, zelar pelos bens da empresa e desempenhar suas funções com zelo e dedicação.</p>

  <p><strong>CLÁUSULA 6ª – DA RESCISÃO:</strong> O presente contrato poderá ser rescindido por qualquer das partes, observando-se os prazos legais de aviso prévio, nos termos dos artigos 477 a 490 da CLT.</p>

  <p><strong>CLÁUSULA 7ª – DO FORO:</strong> Fica eleito o foro da comarca de <strong>{{system.city}}</strong> para dirimir quaisquer dúvidas oriundas deste contrato.</p>

  <p style="margin-top:20px">E por estarem justas e acordadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma.</p>

  <p style="text-align:right;margin-top:8px"><strong>{{system.city}}, {{system.today_extenso}}</strong></p>

  <!-- Assinaturas -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:60px">
    <div style="text-align:center">
      <div style="border-top:1px solid #333;padding-top:8px">
        <p style="margin:2px 0;font-weight:bold">{{company.name}}</p>
        <p style="margin:2px 0;font-size:9pt;color:#555">CNPJ: {{company.cnpj}}</p>
        <p style="margin:2px 0;font-size:9pt;color:#555">CONTRATANTE</p>
      </div>
    </div>
    <div style="text-align:center">
      <div style="border-top:1px solid #333;padding-top:8px">
        <p style="margin:2px 0;font-weight:bold">{{employee.full_name}}</p>
        <p style="margin:2px 0;font-size:9pt;color:#555">CPF: {{employee.cpf}}</p>
        <p style="margin:2px 0;font-size:9pt;color:#555">CONTRATADO(A)</p>
      </div>
    </div>
  </div>

  <p style="text-align:center;margin-top:40px;font-size:8pt;color:#999;border-top:1px solid #eee;padding-top:8px">
    Documento gerado em {{system.today}} pelo sistema PontoFlex
  </p>
</div>
`
  },
  {
    name: "Solicitação de Desconto VT e VR",
    description: "Autorização de desconto de Vale-Transporte e Vale-Refeição",
    category: "declaracao",
    html_content: `
<div style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.7;color:#111;max-width:800px;margin:0 auto">

  <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px">
    <div style="margin-bottom:10px">{{company.logo}}</div>
    <h1 style="font-size:14pt;font-weight:bold;margin:0;letter-spacing:1px">AUTORIZAÇÃO DE DESCONTO</h1>
    <p style="margin:4px 0 0;font-size:9pt;color:#555">Vale-Transporte e Vale-Refeição/Alimentação</p>
  </div>

  <p>Eu, <strong>{{employee.full_name}}</strong>, portador(a) do CPF nº <strong>{{employee.cpf}}</strong>, RG nº <strong>{{employee.rg}}</strong>, admitido(a) em <strong>{{employee.hire_date}}</strong> no cargo de <strong>{{employee.job_function}}</strong>, AUTORIZO expressamente a empresa <strong>{{company.name}}</strong>, CNPJ <strong>{{company.cnpj}}</strong>, a proceder aos descontos em minha folha de pagamento referentes aos benefícios abaixo relacionados:</p>

  <h2 style="font-size:11pt;margin-top:20px;border-bottom:1px solid #ccc;padding-bottom:4px">1. VALE-TRANSPORTE (VT)</h2>
  <p>Nos termos do Decreto nº 95.247/87, AUTORIZO o desconto de até <strong>6% (seis por cento)</strong> do meu salário base mensal correspondente ao custo do benefício Vale-Transporte, a ser utilizado exclusivamente para deslocamento residência-trabalho-residência.</p>
  <div style="background:#f9f9f9;border-left:4px solid #6366f1;padding:10px 14px;margin:10px 0">
    <p style="margin:3px 0"><strong>Salário Base:</strong> {{employee.salary}}</p>
    <p style="margin:3px 0"><strong>Desconto máximo (6%):</strong> a ser calculado pela empresa</p>
  </div>

  <h2 style="font-size:11pt;margin-top:20px;border-bottom:1px solid #ccc;padding-bottom:4px">2. VALE-REFEIÇÃO / VALE-ALIMENTAÇÃO (VR/VA)</h2>
  <p>AUTORIZO o desconto correspondente à participação do empregado no custo do benefício Vale-Refeição/Alimentação, conforme percentual definido em convenção coletiva ou política interna da empresa, podendo variar conforme os dias efetivamente trabalhados no mês.</p>

  <h2 style="font-size:11pt;margin-top:20px;border-bottom:1px solid #ccc;padding-bottom:4px">3. DISPOSIÇÕES GERAIS</h2>
  <p>Esta autorização é válida enquanto perdurar o vínculo empregatício, podendo ser revogada a qualquer momento mediante comunicação escrita com antecedência mínima de 30 (trinta) dias. Os descontos serão efetivados mensalmente conforme os dias trabalhados, faltas e afastamentos no período.</p>

  <p style="margin-top:20px">Declaro estar ciente de que esta autorização é voluntária e que poderei optar pelo cancelamento do benefício quando entender conveniente, sem prejuízo de qualquer natureza.</p>

  <p style="text-align:right;margin-top:16px"><strong>{{system.city}}, {{system.today_extenso}}</strong></p>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:60px">
    <div style="text-align:center">
      <div style="border-top:1px solid #333;padding-top:8px">
        <p style="margin:2px 0;font-weight:bold">{{employee.full_name}}</p>
        <p style="margin:2px 0;font-size:9pt;color:#555">CPF: {{employee.cpf}}</p>
        <p style="margin:2px 0;font-size:9pt;color:#555">EMPREGADO(A)</p>
      </div>
    </div>
    <div style="text-align:center">
      <div style="border-top:1px solid #333;padding-top:8px">
        <p style="margin:2px 0;font-weight:bold">{{company.name}}</p>
        <p style="margin:2px 0;font-size:9pt;color:#555">CNPJ: {{company.cnpj}}</p>
        <p style="margin:2px 0;font-size:9pt;color:#555">EMPREGADOR</p>
      </div>
    </div>
  </div>

  <p style="text-align:center;margin-top:40px;font-size:8pt;color:#999;border-top:1px solid #eee;padding-top:8px">
    Documento gerado em {{system.today}} pelo sistema PontoFlex
  </p>
</div>
`
  },
  {
    name: "Termo de Banco de Horas",
    description: "Acordo individual de compensação de horas – Banco de Horas",
    category: "termo",
    html_content: `
<div style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.7;color:#111;max-width:800px;margin:0 auto">

  <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px">
    <div style="margin-bottom:10px">{{company.logo}}</div>
    <h1 style="font-size:14pt;font-weight:bold;margin:0;letter-spacing:1px">TERMO DE ACORDO INDIVIDUAL</h1>
    <p style="margin:4px 0 0;font-size:9pt;color:#555">Compensação de Jornada – Banco de Horas (Art. 59, §5º e §6º da CLT)</p>
  </div>

  <p>Pelo presente instrumento, de um lado a empresa <strong>{{company.name}}</strong>, inscrita no CNPJ sob o nº <strong>{{company.cnpj}}</strong>, com sede em <strong>{{company.address}}</strong>, doravante denominada EMPREGADORA, e de outro lado, o(a) empregado(a) <strong>{{employee.full_name}}</strong>, portador(a) do CPF nº <strong>{{employee.cpf}}</strong>, CTPS nº <strong>{{employee.ctps_number}}</strong>/Série <strong>{{employee.ctps_series}}</strong>, exercendo a função de <strong>{{employee.job_function}}</strong>, admitido(a) em <strong>{{employee.hire_date}}</strong>, doravante denominado(a) EMPREGADO(A), celebram o presente Acordo Individual de Compensação de Jornada, mediante as seguintes cláusulas:</p>

  <h2 style="font-size:11pt;margin-top:18px;border-bottom:1px solid #ccc;padding-bottom:4px">CLÁUSULA 1ª – DO OBJETO</h2>
  <p>As partes convencionam a adoção do regime de compensação de horas de trabalho denominado <strong>BANCO DE HORAS</strong>, nos termos do Art. 59, §5º e §6º da CLT, incluído pela Lei nº 9.601/98 e alterado pela Lei nº 13.467/2017 (Reforma Trabalhista).</p>

  <h2 style="font-size:11pt;margin-top:18px;border-bottom:1px solid #ccc;padding-bottom:4px">CLÁUSULA 2ª – DO PRAZO DE COMPENSAÇÃO</h2>
  <p>As horas extras prestadas deverão ser compensadas no prazo máximo de <strong>6 (seis) meses</strong>, contados da data do excesso. Não havendo compensação no prazo acordado, as horas serão pagas com o adicional legal correspondente.</p>

  <h2 style="font-size:11pt;margin-top:18px;border-bottom:1px solid #ccc;padding-bottom:4px">CLÁUSULA 3ª – DAS HORAS EXTRAS</h2>
  <p>A prestação de horas extras fica limitada a <strong>2 (duas) horas diárias</strong>, nos termos do Art. 59, caput da CLT. O controle das horas é feito através do sistema eletrônico de ponto, sendo o saldo consultado pelo empregado a qualquer momento.</p>

  <h2 style="font-size:11pt;margin-top:18px;border-bottom:1px solid #ccc;padding-bottom:4px">CLÁUSULA 4ª – DA COMPENSAÇÃO</h2>
  <p>A compensação poderá ocorrer mediante: (a) redução da jornada em dia regular; (b) concessão de folga; (c) saída antecipada; sempre com prévio acordo entre as partes e comunicação com antecedência mínima de <strong>24 horas</strong>.</p>

  <h2 style="font-size:11pt;margin-top:18px;border-bottom:1px solid #ccc;padding-bottom:4px">CLÁUSULA 5ª – DA RESCISÃO CONTRATUAL</h2>
  <p>Em caso de rescisão do contrato de trabalho, o saldo positivo do banco de horas será pago como hora extra com adicional de 50% (cinquenta por cento). O saldo negativo não poderá ser descontado do empregado, salvo se decorrente de culpa do empregado comprovada.</p>

  <h2 style="font-size:11pt;margin-top:18px;border-bottom:1px solid #ccc;padding-bottom:4px">CLÁUSULA 6ª – DA VIGÊNCIA</h2>
  <p>O presente acordo entra em vigor na data de sua assinatura e vigorará pelo período de <strong>1 (um) ano</strong>, podendo ser renovado automaticamente por igual período, salvo manifestação contrária de qualquer das partes com antecedência de 30 dias.</p>

  <p style="text-align:right;margin-top:16px"><strong>{{system.city}}, {{system.today_extenso}}</strong></p>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:60px">
    <div style="text-align:center">
      <div style="border-top:1px solid #333;padding-top:8px">
        <p style="margin:2px 0;font-weight:bold">{{company.name}}</p>
        <p style="margin:2px 0;font-size:9pt;color:#555">CNPJ: {{company.cnpj}}</p>
        <p style="margin:2px 0;font-size:9pt;color:#555">EMPREGADORA</p>
      </div>
    </div>
    <div style="text-align:center">
      <div style="border-top:1px solid #333;padding-top:8px">
        <p style="margin:2px 0;font-weight:bold">{{employee.full_name}}</p>
        <p style="margin:2px 0;font-size:9pt;color:#555">CPF: {{employee.cpf}} | Mat.: {{employee.employee_number}}</p>
        <p style="margin:2px 0;font-size:9pt;color:#555">EMPREGADO(A)</p>
      </div>
    </div>
  </div>

  <p style="text-align:center;margin-top:40px;font-size:8pt;color:#999;border-top:1px solid #eee;padding-top:8px">
    Documento gerado em {{system.today}} pelo sistema PontoFlex
  </p>
</div>
`
  },
  {
    name: "Declaração de Comparecimento",
    description: "Declaração para fins de comprovação de trabalho",
    category: "declaracao",
    html_content: `
<div style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.7;color:#111;max-width:800px;margin:0 auto">

  <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px">
    <div style="margin-bottom:10px">{{company.logo}}</div>
    <h1 style="font-size:15pt;font-weight:bold;margin:0;letter-spacing:1px">DECLARAÇÃO DE VÍNCULO EMPREGATÍCIO</h1>
  </div>

  <p>A empresa <strong>{{company.name}}</strong>, inscrita no CNPJ sob o nº <strong>{{company.cnpj}}</strong>, com sede em <strong>{{company.address}}</strong>, <strong>DECLARA</strong>, para os devidos fins de direito, que:</p>

  <div style="background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:14px 20px;margin:20px 0">
    <p style="margin:4px 0"><strong>Nome:</strong> {{employee.full_name}}</p>
    <p style="margin:4px 0"><strong>CPF:</strong> {{employee.cpf}}</p>
    <p style="margin:4px 0"><strong>RG:</strong> {{employee.rg}}</p>
    <p style="margin:4px 0"><strong>Cargo/Função:</strong> {{employee.job_function}}</p>
    <p style="margin:4px 0"><strong>Data de Admissão:</strong> {{employee.hire_date}}</p>
    <p style="margin:4px 0"><strong>Remuneração:</strong> {{employee.salary}}</p>
    <p style="margin:4px 0"><strong>Regime:</strong> Celetista (CLT)</p>
    <p style="margin:4px 0"><strong>Jornada:</strong> {{company.work_start_time}} às {{company.work_end_time}}</p>
  </div>

  <p>O(a) acima identificado(a) mantém vínculo empregatício ativo com esta empresa, gozando de todos os direitos trabalhistas previstos na Consolidação das Leis do Trabalho.</p>

  <p>Declaramos ainda que suas obrigações financeiras são compatíveis com sua renda mensal, comprometendo-se a empresa a informar qualquer alteração na situação empregatícia do(a) referido(a) colaborador(a).</p>

  <p>Esta declaração é expedida a pedido do(a) interessado(a) para fins de <strong>_______________________________________________</strong>.</p>

  <p style="text-align:right;margin-top:20px"><strong>{{system.city}}, {{system.today_extenso}}</strong></p>

  <div style="margin-top:70px;text-align:center;max-width:300px">
    <div style="border-top:1px solid #333;padding-top:8px">
      <p style="margin:2px 0;font-weight:bold">{{company.name}}</p>
      <p style="margin:2px 0;font-size:9pt;color:#555">CNPJ: {{company.cnpj}}</p>
      <p style="margin:2px 0;font-size:9pt;color:#555">Responsável / RH</p>
    </div>
  </div>

  <p style="text-align:center;margin-top:40px;font-size:8pt;color:#999;border-top:1px solid #eee;padding-top:8px">
    Documento gerado em {{system.today}} pelo sistema PontoFlex
  </p>
</div>
`
  }
];