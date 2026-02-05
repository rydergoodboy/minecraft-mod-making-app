const conceptEl = document.getElementById('concept');
const modIdEl = document.getElementById('modid');
const modTypeEl = document.getElementById('modType');
const generateBtn = document.getElementById('generate');
const statusEl = document.getElementById('status');
const previewCard = document.getElementById('preview-card');
const previewEl = document.getElementById('preview');
const downloadBtn = document.getElementById('download');

let lastBundle = null;

const safeId = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40) || 'generated_mod';

const title = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function parseKeywords(text) {
  return [...new Set(text.toLowerCase().match(/[a-z]{4,}/g) || [])].slice(0, 5);
}

function buildModSpec(input, explicitModId, modType) {
  const keywords = parseKeywords(input);
  const modid = safeId(explicitModId || keywords.slice(0, 2).join('_') || input || 'generated_mod');
  const packagePath = `com/modmint/${modid}`;
  const mainClass = `${modid
    .split('_')
    .map((part) => title(part))
    .join('')}Mod`;

  const items = keywords.map((word) => ({
    id: `${word}_core`,
    name: `${title(word)} Core`,
  }));

  const blocks = keywords.slice(0, 3).map((word) => ({
    id: `${word}_block`,
    name: `${title(word)} Block`,
  }));

  return {
    input,
    modType,
    modid,
    packagePath,
    mainClass,
    keywords,
    items,
    blocks,
    description: `A generated ${modType} mod inspired by: ${input}`,
  };
}

function javaString(str) {
  return str.replace(/"/g, '\\"');
}

function generateFiles(spec) {
  const gradleProps = `org.gradle.jvmargs=-Xmx1G\norg.gradle.parallel=true\n`;

  const modJson = {
    schemaVersion: 1,
    id: spec.modid,
    version: '1.0.0',
    name: title(spec.modid.replace(/_/g, ' ')),
    description: spec.description,
    authors: ['ModMint'],
    contact: { sources: 'https://example.com/modmint' },
    license: 'MIT',
    environment: '*',
    entrypoints: {
      main: [`${spec.packagePath.replace(/\//g, '.')}.${spec.mainClass}`],
    },
    depends: {
      fabricloader: '>=0.15.0',
      minecraft: '1.20.x',
      java: '>=17',
      fabric: '*',
    },
  };

  const itemRegistrations = spec.items
    .map(
      (item) =>
        `    public static final Item ${item.id.toUpperCase()} = registerItem("${item.id}");`
    )
    .join('\n');

  const itemInitLog = spec.items.map((item) => item.id).join(', ') || 'no items';

  const blockRegistrations = spec.blocks
    .map(
      (block) =>
        `    public static final Block ${block.id.toUpperCase()} = registerBlock("${block.id}");`
    )
    .join('\n');

  const blockInitLog = spec.blocks.map((block) => block.id).join(', ') || 'no blocks';

  const mainJava = `package ${spec.packagePath.replace(/\//g, '.')};

import net.fabricmc.api.ModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ${spec.mainClass} implements ModInitializer {
    public static final String MOD_ID = "${spec.modid}";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    @Override
    public void onInitialize() {
        ModItems.initialize();
        ModBlocks.initialize();
        LOGGER.info("${javaString(spec.description)}");
    }
}
`;

  const itemsJava = `package ${spec.packagePath.replace(/\//g, '.')};

import net.minecraft.item.Item;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.util.Identifier;

public class ModItems {
${itemRegistrations || '    // Add generated items here.'}

    private static Item registerItem(String id) {
        return Registry.register(Registries.ITEM, Identifier.of(${spec.mainClass}.MOD_ID, id), new Item(new Item.Settings()));
    }

    public static void initialize() {
        ${spec.mainClass}.LOGGER.info("Registering generated items: ${itemInitLog}");
    }
}
`;

  const blocksJava = `package ${spec.packagePath.replace(/\//g, '.')};

import net.minecraft.block.AbstractBlock;
import net.minecraft.block.Block;
import net.minecraft.block.MapColor;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.util.Identifier;

public class ModBlocks {
${blockRegistrations || '    // Add generated blocks here.'}

    private static Block registerBlock(String id) {
        return Registry.register(Registries.BLOCK, Identifier.of(${spec.mainClass}.MOD_ID, id),
                new Block(AbstractBlock.Settings.create().mapColor(MapColor.STONE_GRAY).strength(2.0f)));
    }

    public static void initialize() {
        ${spec.mainClass}.LOGGER.info("Registering generated blocks: ${blockInitLog}");
    }
}
`;

  const readme = `# ${title(spec.modid.replace(/_/g, ' '))}

${spec.description}

## Generated concept tokens
${spec.keywords.map((k) => `- ${k}`).join('\n') || '- none'}

## Quick start
1. Install Java 17+
2. Run \`./gradlew build\`
3. Run \`./gradlew runClient\`
`;

  return {
    'settings.gradle': `rootProject.name = "${spec.modid}"\n`,
    'gradle.properties': gradleProps,
    'src/main/resources/fabric.mod.json': `${JSON.stringify(modJson, null, 2)}\n`,
    [`src/main/java/${spec.packagePath}/${spec.mainClass}.java`]: mainJava,
    [`src/main/java/${spec.packagePath}/ModItems.java`]: itemsJava,
    [`src/main/java/${spec.packagePath}/ModBlocks.java`]: blocksJava,
    'README.md': readme,
  };
}

function renderPreview(spec) {
  const tokens = spec.keywords.map((k) => `<span class="token">${k}</span>`).join('');
  previewEl.innerHTML = `
    <p><strong>Mod type:</strong> ${spec.modType}</p>
    <p><strong>Mod ID:</strong> ${spec.modid}</p>
    <p><strong>Main class:</strong> ${spec.mainClass}</p>
    <p><strong>Package:</strong> ${spec.packagePath.replace(/\//g, '.')}</p>
    <div><strong>Extracted keywords:</strong><br/>${tokens || 'No keywords found; using fallback defaults.'}</div>
    <pre>${spec.description}</pre>
  `;
}

generateBtn.addEventListener('click', async () => {
  const concept = conceptEl.value.trim();
  if (!concept) {
    statusEl.textContent = 'Please describe your idea first.';
    return;
  }

  const spec = buildModSpec(concept, modIdEl.value.trim(), modTypeEl.value);
  const files = generateFiles(spec);

  lastBundle = { spec, files };
  renderPreview(spec);
  previewCard.hidden = false;
  statusEl.textContent = 'Generated mod app blueprint. Click download to get your zip.';
});

downloadBtn.addEventListener('click', async () => {
  if (!lastBundle) {
    statusEl.textContent = 'Generate a mod app first.';
    return;
  }

  const zip = new JSZip();
  const root = zip.folder(lastBundle.spec.modid);
  Object.entries(lastBundle.files).forEach(([path, contents]) => root.file(path, contents));

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${lastBundle.spec.modid}-mod-app.zip`);
  statusEl.textContent = 'Downloaded! Open the zip to start building your generated mod.';
});
