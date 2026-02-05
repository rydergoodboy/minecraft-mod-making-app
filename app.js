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
  const gradleProps = `org.gradle.jvmargs=-Xmx2G\norg.gradle.parallel=true\n`;

  const itemInitLog = spec.items.map((item) => item.id).join(', ') || 'no items';

  const blockInitLog = spec.blocks.map((block) => block.id).join(', ') || 'no blocks';

  const mainJava = `package ${spec.packagePath.replace(/\//g, '.')};

import com.mojang.logging.LogUtils;
import net.minecraftforge.eventbus.api.IEventBus;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import org.slf4j.Logger;

@Mod(${spec.mainClass}.MOD_ID)
public class ${spec.mainClass} {
    public static final String MOD_ID = "${spec.modid}";
    public static final Logger LOGGER = LogUtils.getLogger();

    public ${spec.mainClass}() {
        IEventBus modEventBus = FMLJavaModLoadingContext.get().getModEventBus();
        ModItems.register(modEventBus);
        ModBlocks.register(modEventBus);
        LOGGER.info("${javaString(spec.description)}");
    }
}
`;

  const itemsJava = `package ${spec.packagePath.replace(/\//g, '.')};

import net.minecraft.world.item.Item;
import net.minecraftforge.eventbus.api.IEventBus;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;

public class ModItems {
    public static final DeferredRegister<Item> ITEMS =
            DeferredRegister.create(ForgeRegistries.ITEMS, ${spec.mainClass}.MOD_ID);

${spec.items
  .map(
    (item) =>
      `    public static final RegistryObject<Item> ${item.id.toUpperCase()} = ITEMS.register("${item.id}",
            () -> new Item(new Item.Properties()));`
  )
  .join('\n') || '    // Add generated items here.'}

    public static void register(IEventBus eventBus) {
        ITEMS.register(eventBus);
        ${spec.mainClass}.LOGGER.info("Registering generated items: ${itemInitLog}");
    }
}
`;

  const blocksJava = `package ${spec.packagePath.replace(/\//g, '.')};

import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.material.MapColor;
import net.minecraftforge.eventbus.api.IEventBus;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;

public class ModBlocks {
    public static final DeferredRegister<Block> BLOCKS =
            DeferredRegister.create(ForgeRegistries.BLOCKS, ${spec.mainClass}.MOD_ID);

${spec.blocks
  .map(
    (block) =>
      `    public static final RegistryObject<Block> ${block.id.toUpperCase()} = BLOCKS.register("${block.id}",
            () -> new Block(BlockBehaviour.Properties.of().mapColor(MapColor.STONE).strength(2.0f)));`
  )
  .join('\n') || '    // Add generated blocks here.'}

    public static void register(IEventBus eventBus) {
        BLOCKS.register(eventBus);
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

  const modDisplayName = title(spec.modid.replace(/_/g, ' '));
  const packageName = spec.packagePath.replace(/\//g, '.');

  const settingsGradle = `pluginManagement {
    repositories {
        gradlePluginPortal()
        maven { url = 'https://maven.minecraftforge.net' }
        mavenCentral()
    }
}

rootProject.name = "${spec.modid}"
`;

  const buildGradle = `plugins {
    id 'eclipse'
    id 'idea'
    id 'maven-publish'
    id 'net.minecraftforge.gradle' version '[6.0,6.2)'
}

group = '${packageName}'
version = '1.0.0'

base {
    archivesName = '${spec.modid}'
}

java.toolchain.languageVersion = JavaLanguageVersion.of(17)

minecraft {
    mappings channel: 'official', version: '1.20.1'

    runs {
        configureEach {
            workingDirectory project.file('run')
            property 'forge.logging.console.level', 'debug'
            mods {
                "${spec.modid}" {
                    source sourceSets.main
                }
            }
        }

        client {}
        server {}
    }
}

repositories {
    mavenCentral()
}

dependencies {
    minecraft 'net.minecraftforge:forge:1.20.1-47.2.0'
}

tasks.withType(JavaCompile).configureEach {
    options.encoding = 'UTF-8'
}
`;

  const modsToml = `modLoader="javafml"
loaderVersion="[47,)"
license="MIT"

[[mods]]
modId="${spec.modid}"
version="\${file.jarVersion}"
displayName="${modDisplayName}"
authors="ModMint"
description='''
${spec.description}
'''

[[dependencies.${spec.modid}]]
modId="forge"
mandatory=true
versionRange="[47,)"
ordering="NONE"
side="BOTH"

[[dependencies.${spec.modid}]]
modId="minecraft"
mandatory=true
versionRange="[1.20.1,1.21)"
ordering="NONE"
side="BOTH"
`;

  const packMcmeta = `{
  "pack": {
    "description": "${javaString(spec.description)}",
    "pack_format": 15
  }
}
`;

  return {
    'settings.gradle': settingsGradle,
    'build.gradle': buildGradle,
    'gradle.properties': gradleProps,
    'src/main/resources/META-INF/mods.toml': modsToml,
    'src/main/resources/pack.mcmeta': packMcmeta,
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
  saveAs(blob, `${lastBundle.spec.modid}-forge-1.20.1-mod-app.zip`);
  statusEl.textContent = 'Downloaded! Open the zip to start building your generated mod.';
});
