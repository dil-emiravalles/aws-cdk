import * as chalk from 'chalk';
import { minimatch } from 'minimatch';
import * as version from '../../lib/version';
import { print, error, warning } from '../logging';
import { Context, PROJECT_CONFIG, PROJECT_CONTEXT, Settings, USER_DEFAULTS } from '../settings';
import { renderTable } from '../util';

/**
 * Options for the context command
 */
export interface ContextOptions {
  /**
   * The context object sourced from all context locations
   */
  context: Context;

  /**
   * Context object specific to cdk.context.json
   */
  projectContext: Settings;

  /**
   * The context key (or its index) to reset
   *
   * @default undefined
   */
  reset?: string;

  /**
   * Ignore missing key error
   *
   * @default false
   */
  force?: boolean;

  /**
   * Clear all context
   *
   * @default false
   */
  clear?: boolean;

  /**
   * Use JSON output instead of YAML when templates are printed to STDOUT
   *
   * @default false
   */
  json?: boolean;
}

export async function context(options: ContextOptions): Promise<number> {
  if (options.clear) {
    options.context.clear();
    await options.projectContext.save(PROJECT_CONTEXT);
    print('All context values cleared.');
  } else if (options.reset) {
    invalidateContext(options.context, options.reset, options.force ?? false);
    await options.projectContext.save(PROJECT_CONTEXT);
  } else {
    // List -- support '--json' flag
    if (options.json) {
      const contextValues = options.context.all;
      process.stdout.write(JSON.stringify(contextValues, undefined, 2));
    } else {
      listContext(options.context);
    }
  }
  await version.displayVersionMessage();

  return 0;
}

function listContext(contextObj: Context) {
  const keys = contextKeys(contextObj);

  if (keys.length === 0) {
    print('This CDK application does not have any saved context values yet.');
    print('');
    print('Context will automatically be saved when you synthesize CDK apps');
    print('that use environment context information like AZ information, VPCs,');
    print('SSM parameters, and so on.');

    return;
  }

  // Print config by default
  const data: any[] = [[chalk.green('#'), chalk.green('Key'), chalk.green('Value')]];
  for (const [i, key] of keys) {
    const jsonWithoutNewlines = JSON.stringify(contextObj.all[key], undefined, 2).replace(/\s+/g, ' ');
    data.push([i, key, jsonWithoutNewlines]);
  }
  print('Context found in %s:', chalk.blue(PROJECT_CONFIG));
  print('');
  print(renderTable(data, process.stdout.columns));

  // eslint-disable-next-line max-len
  print(`Run ${chalk.blue('cdk context --reset KEY_OR_NUMBER')} to remove a context key. It will be refreshed on the next CDK synthesis run.`);
}

function invalidateContext(contextObj: Context, key: string, force: boolean) {
  const i = parseInt(key, 10);
  if (`${i}` === key) {
    // was a number and we fully parsed it.
    key = keyByNumber(contextObj, i);
  }
  // Unset!
  if (contextObj.has(key)) {
    contextObj.unset(key);
    // check if the value was actually unset.
    if (!contextObj.has(key)) {
      print('Context value %s reset. It will be refreshed on next synthesis', chalk.blue(key));
      return;
    }

    // Value must be in readonly bag
    error('Only context values specified in %s can be reset through the CLI', chalk.blue(PROJECT_CONTEXT));
    if (!force) {
      throw new Error(`Cannot reset readonly context value with key: ${key}`);
    }
  }

  // check if value is expression matching keys
  const matches = keysByExpression(contextObj, key);

  if (matches.length > 0) {

    matches.forEach((match) => {
      contextObj.unset(match);
    });

    const { unset, readonly } = getUnsetAndReadonly(contextObj, matches);

    // output the reset values
    printUnset(unset);

    // warn about values not reset
    printReadonly(readonly);

    // throw when none of the matches were reset
    if (!force && unset.length === 0) {
      throw new Error('None of the matched context values could be reset');
    }
    return;
  }
  if (!force) {
    throw new Error(`No context value matching key: ${key}`);
  }
}

function printUnset(unset: string[]) {
  if (unset.length === 0) return;
  print('The following matched context values reset. They will be refreshed on next synthesis');
  unset.forEach((match) => {
    print('  %s', match);
  });
}

function printReadonly(readonly: string[]) {
  if (readonly.length === 0) return;
  warning('The following matched context values could not be reset through the CLI');
  readonly.forEach((match) => {
    print('  %s', match);
  });
  print('');
  print('This usually means they are configured in %s or %s', chalk.blue(PROJECT_CONFIG), chalk.blue(USER_DEFAULTS));
}

function keysByExpression(contextObj: Context, expression: string) {
  return contextObj.keys.filter(minimatch.filter(expression));
}

function getUnsetAndReadonly(contextObj: Context, matches: string[]) {
  return matches.reduce<{ unset: string[]; readonly: string[] }>((acc, match) => {
    if (contextObj.has(match)) {
      acc.readonly.push(match);
    } else {
      acc.unset.push(match);
    }
    return acc;
  }, { unset: [], readonly: [] });
}

function keyByNumber(contextObj: Context, n: number) {
  for (const [i, key] of contextKeys(contextObj)) {
    if (n === i) {
      return key;
    }
  }
  throw new Error(`No context key with number: ${n}`);
}

/**
 * Return enumerated keys in a definitive order
 */
function contextKeys(contextObj: Context): [number, string][] {
  const keys = contextObj.keys;
  keys.sort();
  return enumerate1(keys);
}

function enumerate1<T>(xs: T[]): Array<[number, T]> {
  const ret = new Array<[number, T]>();
  let i = 1;
  for (const x of xs) {
    ret.push([i, x]);
    i += 1;
  }
  return ret;
}
