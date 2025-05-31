import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';

/**
 * Helper for working with pre-compiled Move bytecode
 */
export class PrecompiledBytecodeHelper {
  private readonly logger = new Logger(PrecompiledBytecodeHelper.name);

  /**
   * Load pre-compiled bytecode from a file
   * @param templateName Name of the template (without .bin extension)
   * @returns Array of bytecode arrays
   */
  loadBytecode(templateName = 'coin_template'): number[][] {
    try {
      // Path to pre-compiled bytecode file
      const filePath = path.join(
        __dirname,
        '../../resources',
        `${templateName}.bin`,
      );

      if (!fs.existsSync(filePath)) {
        this.logger.error(`Bytecode file not found: ${filePath}`);
        throw new Error(
          `Pre-compiled bytecode file not found: ${templateName}.bin`,
        );
      }

      // Read the bytecode file
      const bytecode = fs.readFileSync(filePath);

      // Convert to array of numbers
      return [Array.from(bytecode)];
    } catch (error) {
      this.logger.error(`Failed to load bytecode: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get list of available templates
   * @returns Array of template names
   */
  getAvailableTemplates(): string[] {
    try {
      const resourcesDir = path.join(__dirname, '../../resources');

      if (!fs.existsSync(resourcesDir)) {
        return [];
      }

      // Find all .bin files in resources directory
      return fs
        .readdirSync(resourcesDir)
        .filter((file) => file.endsWith('.bin'))
        .map((file) => file.replace('.bin', ''));
    } catch (error) {
      this.logger.error(`Failed to get templates: ${error.message}`);
      return [];
    }
  }
}

export const precompiledBytecode = new PrecompiledBytecodeHelper();
