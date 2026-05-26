const Packages = require('../src/packages');

describe('getRepository', () => {
  it('returns null for missing metadata', () => {
    expect(Packages.getRepository()).toBeNull();
    expect(Packages.getRepository({})).toBeNull();
  });

  it('parses repository.url with https protocol', () => {
    const pack = {
      repository: {
        type: 'git',
        url: 'https://github.com/pulsar-edit/ppm.git'
      }
    };
    expect(Packages.getRepository(pack)).toEqual('pulsar-edit/ppm');
  });

  it('parses repository string', () => {
    const pack = {
      repository: 'https://github.com/pulsar-edit/ppm'
    };
    expect(Packages.getRepository(pack)).toEqual('pulsar-edit/ppm');
  });

  it('parses repository.url with git+https protocol', () => {
    const pack = {
      repository: {
        type: 'git',
        url: 'git+https://github.com/pulsar-edit/ppm.git'
      }
    };
    expect(Packages.getRepository(pack)).toEqual('pulsar-edit/ppm');
  });

  it('returns null for invalid URLs', () => {
    const pack = { repository: 'not-a-url' };
    expect(Packages.getRepository(pack)).toBeNull();
  });
});

describe('getRemote', () => {
  it('returns origin if remote could not be determined', () => {
    expect(Packages.getRemote()).toEqual('origin');
  });

  it('returns repository.url', () => {
    const pack = {
      repository: {
        type: 'git',
        url: 'https://github.com/atom/apm.git'
      }
    };
    expect(Packages.getRemote(pack)).toEqual(pack.repository.url);
  });

  it('returns repository', () => {
    const pack = {
      repository: 'https://github.com/atom/apm'
    };
    expect(Packages.getRemote(pack)).toEqual(pack.repository);
  });
});
