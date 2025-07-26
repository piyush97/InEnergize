import moduleAlias from 'module-alias';
import path from 'path';

// Register module aliases for path resolution
moduleAlias.addAliases({
  '@': path.join(__dirname),
  '@/config': path.join(__dirname, 'config'),
  '@/controllers': path.join(__dirname, 'controllers'),
  '@/services': path.join(__dirname, 'services'),
  '@/models': path.join(__dirname, 'models'),
  '@/middleware': path.join(__dirname, 'middleware'),
  '@/types': path.join(__dirname, 'types'),
  '@/utils': path.join(__dirname, 'utils'),
  '@/routes': path.join(__dirname, 'routes')
});

export {};