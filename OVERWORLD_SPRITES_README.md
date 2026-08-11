# Guia de Instalação - Overworld Sprites

## Passo 1: Baixar os Sprites

### Gen 1-8 (Generation 8 Pack)
1. Acesse: https://www.mediafire.com/file/omlbdmhuu5kn5vq/Generation+8+Pack+v20.1.zip/file
2. Clique em "Download"
3. Extraia o ZIP em uma pasta

### Gen 9 (DarkusShadow)
1. Acesse: https://www.deviantart.com/darkusshadow/art/Gen-9-Paldea-Pokemon-Overworld-Sprites-967776690
2. Clique em "Download" (baixará um PNG individual)
3. Salve na pasta de overworld sprites

## Passo 2: Organizar os Arquivos

Crie uma pasta com esta estrutura:
```
overworld_input/
├── 001/  (Bulbasaur)
│   ├── down.gif
│   ├── left.gif
│   ├── right.gif
│   └── up.gif
├── 002/  (Ivysaur)
│   ├── down.gif
│   └── ...
└── ...
```

## Passo 3: Processar os Sprites

Execute o script:
```bash
node scripts/process-overworld-sprites.js --input ./overworld_input --output ./overworld_output
```

Isso criará sprite sheets 4x4 para cada Pokemon.

## Passo 4: Upload para Supabase

Use o script `upload-overworld-sprites.js` para enviar ao Supabase Storage.

---

## Formato do Sprite Sheet

O sprite sheet segue o mesmo formato do personagem (perso_masculino.webp):
- **Tamanho:** 256x256 pixels
- **Grid:** 4x4 (4 linhas x 4 colunas)
- **Linhas:** Baixo, Esquerda, Direita, Cima
- **Colunas:** 4 frames de animação de caminhada

Exemplo visual:
```
[Baixo1] [Baixo2] [Baixo3] [Baixo4]
[Esq1]   [Esq2]   [Esq3]   [Esq4]
[Dir1]   [Dir2]   [Dir3]   [Dir4]
[Cima1]  [Cima2]  [Cima3]  [Cima4]
```
