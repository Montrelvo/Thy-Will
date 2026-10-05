import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const allowed = {
  'packages/protocol': [],
  'packages/content': [],
  'packages/simulation': ['@thy-will/protocol', '@thy-will/content'],
  'apps/client': ['@thy-will/protocol', '@thy-will/content', '@thy-will/simulation'],
  'apps/game-server': ['@thy-will/protocol', '@thy-will/content', '@thy-will/simulation'],
  'apps/backend': ['@thy-will/protocol'],
};

export function validateImport(workspace, file, specifier) {
  if (specifier.startsWith('.')) {
    const resolved = path.resolve(path.dirname(file), specifier);
    const root = path.resolve(workspace, 'src');
    return resolved.startsWith(`${root}${path.sep}`) ? null : 'Relative import escapes workspace source boundary';
  }
  if (allowed[workspace]?.includes(specifier)) return null;
  // Shared packages are deliberately independent of all platform SDKs.
  if (workspace.startsWith('packages/')) return 'Shared packages cannot import platform SDKs or undeclared packages';
  if (specifier.startsWith('@thy-will/')) return 'Workspace dependency is not allowed';
  if (/^(firebase(?:\/|$)|firebase-admin(?:\/|$)|@firebase\/)/u.test(specifier) && workspace !== 'apps/backend') {
    return 'Firebase integration is deferred; it cannot enter client or game-server yet';
  }
  return null;
}

async function files(root) {
  const result = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...await files(file));
    else if (file.endsWith('.ts')) result.push(file);
  }
  return result;
}

export async function checkBoundaries() {
  const errors = [];
  for (const [workspace, dependencies] of Object.entries(allowed)) {
    const manifest = JSON.parse(await readFile(`${workspace}/package.json`, 'utf8'));
    for (const dependency of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies, ...manifest.optionalDependencies })) {
      const error = validateImport(workspace, `${workspace}/src/index.ts`, dependency);
      if (error) errors.push(`${workspace}/package.json: ${dependency}: ${error}`);
    }
    for (const dependency of dependencies) {
      if (!manifest.dependencies?.[dependency]) errors.push(`${workspace}: missing declared dependency ${dependency}`);
    }
    for (const file of await files(`${workspace}/src`)) {
      const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
      function visit(node) {
        const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier
          : ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) ? node.arguments[0]
          : ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined;
        if (specifier && ts.isStringLiteral(specifier)) {
          const error = validateImport(workspace, file, specifier.text);
          if (error) errors.push(`${file}: ${specifier.text}: ${error}`);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = await checkBoundaries();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else console.log('Workspace boundaries passed.');
}
