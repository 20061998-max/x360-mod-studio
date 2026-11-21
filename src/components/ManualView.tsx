import React from 'react';
import { ArrowRight, BookOpen, Download, ShieldAlert } from 'lucide-react';
import { WorkspaceTab } from '../types/modding';
import { triggerBinaryDownload } from '../utils/binaryPatch';

interface ManualViewProps {
  onNavigateTab: (tab: WorkspaceTab) => void;
}

interface GuideSection {
  number: string;
  title: string;
  tab: WorkspaceTab;
  buttonLabel: string;
  summary: string;
  steps: string[];
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    number: '01.',
    title: 'Auto-Organizador de Pastas e Empacotador (.ZIP)',
    tab: 'organizer',
    buttonLabel: 'Abrir Auto-Organizador',
    summary:
      'Ideal quando você já tem vários arquivos soltos ou uma pasta inteira de mod e quer tudo organizado automaticamente para copiar ao console.',
    steps: [
      'Selecione ou crie um projeto na barra lateral informando o Jogo Base e o Title ID (8 dígitos em hexadecimal).',
      'Clique em "Selecionar Pasta Inteira" (ou arraste a pasta do mod direto do computador para a área tracejada).',
      'Escolha "Auto-Mapear X360" para classificar por tipo (.xex, .gsc, .cfg, .dds, Title Updates) ou "Manter Subpastas Originais" para preservar a árvore da pasta enviada.',
      'Revise ou edite qualquer caminho de destino na tabela e clique em "Baixar Pacote Organizado (.ZIP)".',
    ],
  },
  {
    number: '02.',
    title: 'Edit Game (Substituir Arquivos Direto no Jogo)',
    tab: 'editgame',
    buttonLabel: 'Abrir Edit Game',
    summary:
      'Atualize um jogo colando os novos arquivos diretamente por cima dos arquivos originais, sem precisar criar ou aplicar patch binário.',
    steps: [
      'No Passo 1, selecione ou arraste a pasta original extraída do jogo para mapear todos os arquivos e subpastas.',
      'No Passo 2, arraste ou selecione os arquivos novos (ou uma pasta de modificação) para colar por cima dos originais automaticamente por caminho ou nome.',
      'Também é possível clicar em "Substituir" em qualquer linha específica para trocar apenas aquele arquivo ou restaurar o original.',
      'Baixe o jogo completo atualizado em .ZIP ou baixe somente os arquivos substituídos/novos para colar no HD do Xbox 360.',
    ],
  },
  {
    number: '03.',
    title: 'Pacote de Mod (Futebol, Corrida e Tiro / FPS)',
    tab: 'modpack',
    buttonLabel: 'Abrir Pacote de Mod',
    summary:
      'Gerencie os metadados do projeto e monte configurações estruturadas por gênero de jogo.',
    steps: [
      'Preencha Nome do Mod, Jogo Base, Title ID, Versão e Pasta de Destino no HD do Xbox 360.',
      'Na aba "Arquivos", registre cada arquivo substituído ou adicionado no jogo com o caminho relativo correto.',
      'Em "Carros / Corrida", adicione veículos customizados vinculados ao slot base e baixe o arquivo handling.cfg.',
      'Em "Armas / Tiro", cadastre armas, dano, RPM, carregador e recuo para exportar o script weapons.gsc.',
      'Em "Elencos / Futebol", adicione transferências e novos overalls para exportar em planilha .CSV ou gerar o Guia (.txt).',
    ],
  },
  {
    number: '04.',
    title: 'Criador e Aplicador de Patch Binário (.IPS e .x360patch.json)',
    tab: 'binary',
    buttonLabel: 'Abrir Patch Binário',
    summary:
      'Compartilhe apenas as alterações de uma tradução ou modificação sem precisar distribuir o arquivo inteiro do jogo.',
    steps: [
      'Na aba "Criar Patch", carregue o Arquivo Original (base) e o Arquivo Modificado (editado por você).',
      'Confira a tabela de blocos alterados (offset em hex, tamanho e prévia ASCII).',
      'Clique em "Baixar Patch .IPS" (para arquivos de até 16 MB) ou "Baixar .x360patch.json" (para arquivos maiores).',
      'Para aplicar um patch recebido, mude para a aba "Aplicar Patch", envie o arquivo original + o arquivo de patch e baixe o arquivo final modificado.',
    ],
  },
  {
    number: '05.',
    title: 'Editor Hex PowerPC (Big-Endian)',
    tab: 'hex',
    buttonLabel: 'Abrir Editor Hex',
    summary:
      'Inspecione arquivos binários descompactados usando a ordem de bytes Big-Endian do processador PowerPC do Xbox 360.',
    steps: [
      'Carregue um arquivo binário (.bin, .db, .dat ou .xex já descriptografado no PC) ou use o arquivo de exemplo de futebol.',
      'Use a busca por Texto ASCII, UTF-16 BE, Hex, Int32 BE ou Float32 BE para localizar nomes, anos, overalls ou multiplicadores.',
      'Clique em qualquer byte da grade para ver os valores decodificados no Inspetor PowerPC à direita.',
      'Adicione regras fixas em "Regras de Modificação por Offset" e clique em "Aplicar Regras e Baixar Arquivo".',
    ],
  },
  {
    number: '06.',
    title: 'Capas de Games, Homebrew, Banners & Texturas (.PNG / .DDS / .TGA / .ZIP)',
    tab: 'textures',
    buttonLabel: 'Abrir Capas & Texturas',
    summary:
      'Envie qualquer imagem do seu gosto e formate automaticamente em capas de jogos (350×500 / 600×850 / 1024×680), ícones de homebrew (256×256 / 512×512), banners 720p ou texturas Xbox 360.',
    steps: [
      'Na barra de seleção, escolha entre Capas de Games, Homebrew & Apps, Banners / Fundos, Capa 3D Completa ou Texturas de Jogo.',
      'Envie ou arraste qualquer imagem do seu PC/celular e escolha entre Preencher (Recortar), Inteira com Fundo Blur, Cor Sólida ou Esticar.',
      'Opcionalmente adicione faixa XBOX 360 / HOMEBREW, título e Title ID, depois baixe em .PNG, .DDS, .TGA ou Pacote .ZIP pronto para copiar.',
    ],
  },
  {
    number: '07.',
    title: 'Gerador de launch.ini (DashLaunch)',
    tab: 'dashlaunch',
    buttonLabel: 'Abrir DashLaunch',
    summary:
      'Configure o boot automático para Aurora ou Freestyle Dash e proteções essenciais para consoles com exploit.',
    steps: [
      'Use um dos perfis rápidos ("Aurora no HD Interno", "Aurora no Pendrive" ou "Freestyle 3") ou importe um launch.ini atual.',
      'Ative os bloqueios de segurança recomendados (liveblock, livestrong, noupdater) e os patches de conteúdo (contpatch, licpatch).',
      'Baixe o arquivo launch.ini e copie para a raiz do pendrive (Usb:\\launch.ini) ou HD interno (Hdd:\\launch.ini).',
    ],
  },
  {
    number: '08.',
    title: 'Testador e Validador de Modificações (100% Verificado)',
    tab: 'tester',
    buttonLabel: 'Abrir Testador',
    summary:
      'Confira antes de ir para o console se as regras Hex, carros, armas, elencos, arquivos (.xex, .ips, .dds, .gsc, .zip) e patches estão sem erros.',
    steps: [
      'A auditoria do projeto verifica automaticamente conflitos de slots de carros, sobreposição de offsets Hex, Title ID e launch.ini.',
      'Envie a pasta final do mod ou arquivos soltos para validar cabeçalhos XEX2, dimensões DDS, chaves de scripts GSC e hashes CRC-32/SHA-256.',
      'Use o Simulador de Patch para testar a aplicação de um arquivo .IPS ou .x360patch.json em memória antes de distribuir.',
    ],
  },
  {
    number: '09.',
    title: 'Criador de Skins Xbox 360 (Aurora, Freestyle 3, XeXMenu e NXE)',
    tab: 'skins',
    buttonLabel: 'Abrir Criador de Skins',
    summary:
      'Monte temas personalizados em 1280×720 escolhendo a dashboard na barra de seleção e baixe o pacote completo pronto com XML, INI, .DDS e .TGA.',
    steps: [
      'Use a barra de seleção no topo para escolher o formato exato: Aurora Dashboard, Freestyle 3 (FSD), XeXMenu ou Tema NXE.',
      'Escolha uma paleta pronta ou personalize cores, imagem de fundo (1280×720), logo e estilo de capa.',
      'Clique em "Baixar Skin Completa (.ZIP)" e copie a pasta gerada para Hdd1:\\Aurora\\Skins\\, Hdd1:\\Freestyle\\Skins\\ ou caminho equivalente.',
    ],
  },
];

const PLAIN_TEXT_MANUAL = [
  '============================================================',
  'MANUAL DE USO - X360 MOD STUDIO',
  '============================================================',
  '',
  '1. FLUXO RAPIDO PARA COLOCAR NO XBOX 360 (RGH / JTAG / EXPLOIT)',
  '------------------------------------------------------------',
  '1) Na barra lateral, crie ou escolha seu projeto com o Title ID correto.',
  '2) Abra o "Auto-Organizador (.ZIP)" e clique em "Selecionar Pasta Inteira"',
  '   (ou arraste a pasta do seu mod para a tela).',
  '3) Revise os caminhos de destino gerados e clique em "Baixar Pacote Organizado (.ZIP)".',
  '4) Extraia o arquivo .ZIP no seu PC para um pendrive formatado em FAT32.',
  '5) No Xbox 360 (via Aurora File Manager ou XeXMenu) ou via FTP:',
  '   - Arquivos da pasta Games\\<Jogo> -> copie para Hdd1:\\Games\\<Jogo>\\',
  '   - Arquivos da pasta Content\\0000000000000000\\<TitleID> -> copie para Hdd1:\\Content\\0000000000000000\\<TitleID>\\',
  '   - Arquivo launch.ini (se incluido) -> copie para a raiz Hdd1:\\launch.ini ou Usb0:\\launch.ini',
  '',
  '2. DICAS E CUIDADOS IMPORTANTES',
  '------------------------------------------------------------',
  '- Sempre faca backup dos arquivos originais do jogo antes de substituir.',
  '- O Editor Hex edita bytes diretos: arquivos .xex precisam estar descriptografados',
  '  antes no PC (via XexTool) caso voce queira alterar textos ou offsets internos.',
  '- Mantenha liveblock = true e livestrong = true no launch.ini em consoles com exploit.',
  '- Arquivos de jogos fechados (.ff, .cpk, .rpf) exigem modelos/texturas ja',
  '  convertidos para a engine daquele jogo antes de serem organizados no pacote.',
  '',
].join('\n');

export function ManualView({ onNavigateTab }: ManualViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Manual de Uso — X360 Mod Studio
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Passo a passo completo para organizar pastas de mods, criar patches, ajustar configurações e copiar para o Xbox 360 com exploit.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            triggerBinaryDownload(PLAIN_TEXT_MANUAL, 'MANUAL_X360_MOD_STUDIO.txt', 'text/plain')
          }
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          Baixar Manual (.TXT)
        </button>
      </div>

      {/* Quick Start Transfer Guide */}
      <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <h2 className="text-base font-semibold text-white">
            Como passar os arquivos gerados para o Xbox 360
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs leading-relaxed">
          <div className="p-4 bg-[#0E1525] border border-slate-800 rounded-md space-y-1.5">
            <div className="font-semibold text-white">1. Prepare o Pendrive (FAT32) ou FTP</div>
            <p className="text-slate-400">
              Extraia o arquivo <span className="font-mono text-slate-200">.zip</span> baixado no Auto-Organizador para um pendrive formatado em FAT32, ou conecte no console por FTP usando a dashboard Aurora.
            </p>
          </div>
          <div className="p-4 bg-[#0E1525] border border-slate-800 rounded-md space-y-1.5">
            <div className="font-semibold text-white">2. Copie para as pastas do HD</div>
            <p className="text-slate-400">
              Copie o conteúdo de <span className="font-mono text-emerald-300">Games\...</span> para a pasta do jogo no console, e o conteúdo de{' '}
              <span className="font-mono text-emerald-300">Content\0000000000000000\</span> para o HD interno (<span className="font-mono text-slate-200">Hdd1:\Content\...</span>).
            </p>
          </div>
          <div className="p-4 bg-[#0E1525] border border-slate-800 rounded-md space-y-1.5">
            <div className="font-semibold text-white">3. Re-escaneie na Aurora</div>
            <p className="text-slate-400">
              Se adicionou capas, Title Updates ou um jogo modificado novo, aperte <span className="font-mono text-slate-200">Y</span> no jogo dentro da Aurora (ou faça Scan) para atualizar a visualização.
            </p>
          </div>
        </div>
      </div>

      {/* Module-by-Module Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {GUIDE_SECTIONS.map((section) => (
          <div
            key={section.number}
            className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-3">
              <div className="pb-3 border-b border-slate-800">
                <h3 className="text-base font-semibold text-white">
                  {section.number} {section.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{section.summary}</p>
              </div>

              <ol className="space-y-2 text-xs text-slate-300 leading-relaxed list-decimal list-inside">
                {section.steps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => onNavigateTab(section.tab)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:text-white bg-emerald-950/40 hover:bg-emerald-600 border border-emerald-800/60 hover:border-emerald-500 rounded-md transition-colors whitespace-nowrap"
              >
                {section.buttonLabel}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Important Technical Notes */}
      <div className="bg-[#141D2F] border border-slate-800 rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          Cuidados e Limites Técnicos Importantes
        </div>
        <ul className="space-y-2 text-xs text-slate-300 leading-relaxed list-disc list-inside">
          <li>
            <strong>Sempre faça backup:</strong> guarde uma cópia dos arquivos originais do jogo no PC antes de sobrescrever no Xbox 360.
          </li>
          <li>
            <strong>Arquivos .xex criptografados:</strong> se você quiser editar textos ou valores dentro de um <span className="font-mono text-white">.xex</span> pelo Editor Hex, o executável precisa estar previamente descriptografado/descompactado no PC.
          </li>
          <li>
            <strong>Modelos 3D e arquivos proprietários:</strong> o estúdio organiza pastas, gera patches binários (<span className="font-mono text-white">.ips</span>), scripts (<span className="font-mono text-white">.gsc</span>) e configs (<span className="font-mono text-white">.cfg/.ini</span>), mas modelos 3D ou arquivos <span className="font-mono text-white">.ff/.rpf/.cpk</span> devem estar no formato aceito pela engine daquele jogo.
          </li>
          <li>
            <strong>Segurança no Exploit:</strong> mantenha <span className="font-mono text-white">liveblock = true</span> e <span className="font-mono text-white">livestrong = true</span> no seu <span className="font-mono text-white">launch.ini</span> para evitar conexões acidentais com a Xbox Live.
          </li>
        </ul>
      </div>
    </div>
  );
}
