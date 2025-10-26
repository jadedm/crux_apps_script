/**
 * Lightweight testing framework for Google Apps Script
 */

const TestFramework = {
  tests: [],
  results: {
    passed: 0,
    failed: 0,
    errors: [],
  },

  /**
   * Define a test suite
   * @param {string} description - Test suite description
   * @param {Function} fn - Test suite function
   */
  describe(description, fn) {
    Logger.log(`\n========== ${description} ==========`);
    fn();
  },

  /**
   * Define a test case
   * @param {string} description - Test description
   * @param {Function} fn - Test function
   */
  it(description, fn) {
    try {
      fn();
      this.results.passed++;
      Logger.log(`✓ ${description}`);
    } catch (error) {
      this.results.failed++;
      this.results.errors.push({
        test: description,
        error: error.message,
        stack: error.stack,
      });
      Logger.log(`✗ ${description}`);
      Logger.log(`  Error: ${error.message}`);
    }
  },

  /**
   * Assertion helpers
   */
  expect(actual) {
    return {
      toBe(expected) {
        if (actual !== expected) {
          throw new Error(`Expected ${expected} but got ${actual}`);
        }
      },

      toEqual(expected) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(
            `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(
              actual
            )}`
          );
        }
      },

      toBeNull() {
        if (actual !== null) {
          throw new Error(`Expected null but got ${actual}`);
        }
      },

      toBeUndefined() {
        if (actual !== undefined) {
          throw new Error(`Expected undefined but got ${actual}`);
        }
      },

      toBeTruthy() {
        if (!actual) {
          throw new Error(`Expected truthy value but got ${actual}`);
        }
      },

      toBeFalsy() {
        if (actual) {
          throw new Error(`Expected falsy value but got ${actual}`);
        }
      },

      toThrow(errorMessage) {
        let threw = false;
        let thrownError = null;
        try {
          actual();
        } catch (error) {
          threw = true;
          thrownError = error;
        }

        if (!threw) {
          throw new Error("Expected function to throw but it didn't");
        }

        if (errorMessage && !thrownError.message.includes(errorMessage)) {
          throw new Error(
            `Expected error message to include "${errorMessage}" but got "${thrownError.message}"`
          );
        }
      },

      toContain(item) {
        if (Array.isArray(actual)) {
          if (!actual.includes(item)) {
            throw new Error(`Expected array to contain ${item}`);
          }
        } else if (typeof actual === "string") {
          if (!actual.includes(item)) {
            throw new Error(`Expected string to contain "${item}"`);
          }
        } else {
          throw new Error("toContain can only be used with arrays or strings");
        }
      },

      toHaveLength(length) {
        if (!actual.length === length) {
          throw new Error(
            `Expected length ${length} but got ${actual.length}`
          );
        }
      },

      toBeInstanceOf(className) {
        if (!(actual instanceof className)) {
          throw new Error(
            `Expected instance of ${className.name} but got ${typeof actual}`
          );
        }
      },

      toBeGreaterThan(value) {
        if (actual <= value) {
          throw new Error(
            `Expected ${actual} to be greater than ${value}`
          );
        }
      },

      toBeLessThan(value) {
        if (actual >= value) {
          throw new Error(
            `Expected ${actual} to be less than ${value}`
          );
        }
      },
    };
  },

  /**
   * Print test results summary
   */
  printResults() {
    Logger.log("\n========== TEST RESULTS ==========");
    Logger.log(`Passed: ${this.results.passed}`);
    Logger.log(`Failed: ${this.results.failed}`);
    Logger.log(
      `Total: ${this.results.passed + this.results.failed}`
    );

    if (this.results.failed > 0) {
      Logger.log("\n========== FAILURES ==========");
      this.results.errors.forEach((error, index) => {
        Logger.log(`\n${index + 1}. ${error.test}`);
        Logger.log(`   ${error.error}`);
      });
    }

    return this.results;
  },

  /**
   * Reset test results
   */
  reset() {
    this.results = {
      passed: 0,
      failed: 0,
      errors: [],
    };
  },
};
