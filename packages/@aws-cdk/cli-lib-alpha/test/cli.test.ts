import { join } from 'path';
import * as cli from 'aws-cdk/lib';
import * as core from 'aws-cdk-lib';
import { AwsCdkCli } from '../lib';

// These tests synthesize an actual CDK app and take a bit longer
jest.setTimeout(60_000);

let stdoutMock = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
let exec = jest.spyOn(cli, 'exec');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fromCloudAssemblyDirectoryProducer', () => {
  const testEnv = jest.fn();
  const cdk = AwsCdkCli.fromCloudAssemblyDirectoryProducer({
    produce: async () => {
      const app = new core.App();
      new core.Stack(app, 'Stack1');
      new core.Stack(app, 'Stack2');

      testEnv(process.env);

      return app.synth().directory;
    },
  });

  test('can list all stacks in app', async () => {
    // WHEN
    await cdk.list();

    // THEN
    expect(exec).toHaveBeenCalledWith(
      ['ls', '--all'],
      expect.anything(),
    );
    expect(stdoutMock.mock.calls[0][0]).toContain('Stack1');
    expect(stdoutMock.mock.calls[1][0]).toContain('Stack2');
  });

  test('does set CDK_DEBUG', async () => {
    // WHEN
    await cdk.list({ debug: true });

    // THEN
    expect(testEnv.mock.calls[0][0]).toHaveProperty('CDK_DEBUG', 'true');
  });

  test('does not set CDK_DEBUG when ', async () => {
    // WHEN
    await cdk.list({ debug: false });

    // THEN
    expect(testEnv.mock.calls[0][0]).not.toHaveProperty('CDK_DEBUG');
  });
});

describe('fromDirectory', () => {
  const cdk = AwsCdkCli.fromCdkAppDirectory(join(__dirname, 'test-app'));

  test('can list all stacks in cdk app', async () => {
    // WHEN
    await cdk.list();

    // THEN
    expect(exec).toHaveBeenCalledWith(
      ['ls', '--all'],
    );
    expect(stdoutMock.mock.calls[0][0]).toContain('AppStack1');
    expect(stdoutMock.mock.calls[1][0]).toContain('AppStack2');
  });
});

describe('fromDirectory with config', () => {
  const cdk = AwsCdkCli.fromCdkAppDirectory(join(__dirname, 'test-app'), {
    app: 'node -r ts-node/register app.ts',
    output: 'cdk.out',
  });

  test('can list all stacks in cdk app', async () => {
    // WHEN
    await cdk.list();

    // THEN
    expect(exec).toHaveBeenCalledWith(
      [
        'ls', '--all',
        '--app', 'node -r ts-node/register app.ts',
        '--output', 'cdk.out',
      ],
    );
    expect(stdoutMock.mock.calls[0][0]).toContain('AppStack1');
    expect(stdoutMock.mock.calls[1][0]).toContain('AppStack2');
  });
});
