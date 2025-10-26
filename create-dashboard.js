/**
 * Creates a Core Web Vitals Dashboard with visualizations
 *
 * Run this function after extracting CrUX data to generate charts
 * analyzing your Core Web Vitals performance.
 *
 * Usage: Select createCruxDashboard from function dropdown and click Run
 */
function createCruxDashboard() {
  // Configuration - Update these values
  const SPREADSHEET_ID = "";
  const DATA_SHEET_NAME = "crux-data";

  try {
    Logger.log("Creating Core Web Vitals Dashboard...");

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const dataSheet = spreadsheet.getSheetByName(DATA_SHEET_NAME);

    if (!dataSheet || dataSheet.getLastRow() <= 1) {
      throw new Error(
        "No data found in '" +
          DATA_SHEET_NAME +
          "' sheet. Run extraction first."
      );
    }

    // Get or create dashboard sheet
    let dashboardSheet = spreadsheet.getSheetByName("Dashboard");
    if (dashboardSheet) {
      spreadsheet.deleteSheet(dashboardSheet);
    }
    dashboardSheet = spreadsheet.insertSheet("Dashboard");

    const lastRow = dataSheet.getLastRow();

    // Add title
    dashboardSheet
      .getRange("A1")
      .setValue("📊 Core Web Vitals Dashboard")
      .setFontSize(20)
      .setFontWeight("bold");

    dashboardSheet
      .getRange("A2")
      .setValue("Generated: " + new Date().toLocaleString())
      .setFontSize(10)
      .setFontColor("#666666");

    // Chart 1: Core Web Vitals Score Distribution (Stacked Bar)
    createCWVDistributionChart(spreadsheet, dashboardSheet, dataSheet, lastRow);

    // Chart 2: P75 Comparison (Column Chart)
    createP75ComparisonChart(spreadsheet, dashboardSheet, dataSheet, lastRow);

    // Chart 3: Form Factor Comparison (Grouped Column)
    createFormFactorComparisonChart(
      spreadsheet,
      dashboardSheet,
      dataSheet,
      lastRow
    );

    // Add summary statistics
    createSummaryStats(dashboardSheet, dataSheet, lastRow);

    Logger.log("Dashboard created successfully!");
    SpreadsheetApp.setActiveSheet(dashboardSheet);
  } catch (error) {
    Logger.log("Error creating dashboard: " + error.message);
    throw error;
  }
}

/**
 * Creates Core Web Vitals distribution chart showing Good/Needs Improvement/Poor percentages
 */
function createCWVDistributionChart(
  spreadsheet,
  dashboardSheet,
  dataSheet,
  lastRow
) {
  try {
    const chartBuilder = dashboardSheet
      .newChart()
      .setChartType(Charts.ChartType.BAR)
      .setPosition(4, 1, 0, 0)
      .setOption(
        "title",
        "Core Web Vitals - Score Distribution (% Good/Needs Improvement/Poor)"
      )
      .setOption("width", 900)
      .setOption("height", 450)
      .setOption("isStacked", "percent")
      .setOption("legend", { position: "right" })
      .setOption("colors", ["#0CCE6B", "#FFA400", "#FF4E42"])
      .setOption("hAxis", { format: "#%", minValue: 0, maxValue: 1 })
      .setOption("vAxis", { title: "URL / Form Factor" });

    // Add data ranges for URL/Platform and Core Web Vitals
    chartBuilder.addRange(dataSheet.getRange("C2:C" + lastRow)); // URL
    chartBuilder.addRange(dataSheet.getRange("D2:F" + lastRow)); // LCP Good/Needs/Poor

    dashboardSheet.insertChart(chartBuilder.build());
    Logger.log("Created CWV distribution chart");
  } catch (error) {
    Logger.log("Failed to create CWV distribution chart: " + error.message);
  }
}

/**
 * Creates P75 value comparison chart
 */
function createP75ComparisonChart(
  spreadsheet,
  dashboardSheet,
  dataSheet,
  lastRow
) {
  try {
    const chartBuilder = dashboardSheet
      .newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .setPosition(4, 10, 0, 0)
      .setOption("title", "P75 Values Comparison (Lower is Better)")
      .setOption("width", 700)
      .setOption("height", 450)
      .setOption("legend", { position: "bottom" })
      .setOption("vAxis", { title: "Milliseconds" })
      .setOption("hAxis", {
        title: "URL",
        slantedText: true,
        slantedTextAngle: 45,
      })
      .setOption("colors", ["#4285F4", "#34A853", "#FBBC04", "#EA4335"]);

    // Add P75 values for core metrics
    chartBuilder.addRange(dataSheet.getRange("C2:C" + lastRow)); // URL
    chartBuilder.addRange(dataSheet.getRange("G2:G" + lastRow)); // LCP P75
    chartBuilder.addRange(dataSheet.getRange("O2:O" + lastRow)); // INP P75
    chartBuilder.addRange(dataSheet.getRange("W2:W" + lastRow)); // FCP P75

    dashboardSheet.insertChart(chartBuilder.build());
    Logger.log("Created P75 comparison chart");
  } catch (error) {
    Logger.log("Failed to create P75 comparison chart: " + error.message);
  }
}

/**
 * Creates form factor comparison chart
 */
function createFormFactorComparisonChart(
  spreadsheet,
  dashboardSheet,
  dataSheet,
  lastRow
) {
  try {
    const chartBuilder = dashboardSheet
      .newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .setPosition(29, 1, 0, 0)
      .setOption("title", "Good Score % by Form Factor (Higher is Better)")
      .setOption("width", 900)
      .setOption("height", 400)
      .setOption("legend", { position: "bottom" })
      .setOption("vAxis", {
        title: "% Good Scores",
        format: "#%",
        minValue: 0,
        maxValue: 1,
      })
      .setOption("hAxis", { title: "Form Factor" })
      .setOption("colors", ["#0CCE6B", "#36A2EB", "#FF6384", "#FFCE56"]);

    // Add Good% for each metric by form factor
    chartBuilder.addRange(dataSheet.getRange("B2:B" + lastRow)); // Platform
    chartBuilder.addRange(dataSheet.getRange("D2:D" + lastRow)); // LCP Good
    chartBuilder.addRange(dataSheet.getRange("L2:L" + lastRow)); // INP Good
    chartBuilder.addRange(dataSheet.getRange("P2:P" + lastRow)); // CLS Good
    chartBuilder.addRange(dataSheet.getRange("T2:T" + lastRow)); // FCP Good

    dashboardSheet.insertChart(chartBuilder.build());
    Logger.log("Created form factor comparison chart");
  } catch (error) {
    Logger.log("Failed to create form factor chart: " + error.message);
  }
}

/**
 * Creates summary statistics table
 */
function createSummaryStats(dashboardSheet, dataSheet, lastRow) {
  try {
    // Add summary section
    dashboardSheet
      .getRange("A54")
      .setValue("📈 Summary Statistics")
      .setFontSize(14)
      .setFontWeight("bold");

    dashboardSheet
      .getRange("A56:D56")
      .setValues([["Metric", "Avg Good %", "Avg P75", "Status"]])
      .setFontWeight("bold");

    // Calculate averages for LCP
    const lcpGoodAvg =
      "=AVERAGE('" + dataSheet.getName() + "'!D2:D" + lastRow + ")";
    const lcpP75Avg =
      "=AVERAGE('" + dataSheet.getName() + "'!G2:G" + lastRow + ")";
    dashboardSheet
      .getRange("A57:D57")
      .setValues([
        [
          "LCP",
          lcpGoodAvg,
          lcpP75Avg,
          '=IF(B57>0.75,"✅ Good",IF(B57>0.5,"⚠️ Needs Work","❌ Poor"))',
        ],
      ]);

    // Calculate averages for INP
    const inpGoodAvg =
      "=AVERAGE('" + dataSheet.getName() + "'!L2:L" + lastRow + ")";
    const inpP75Avg =
      "=AVERAGE('" + dataSheet.getName() + "'!O2:O" + lastRow + ")";
    dashboardSheet
      .getRange("A58:D58")
      .setValues([
        [
          "INP",
          inpGoodAvg,
          inpP75Avg,
          '=IF(B58>0.75,"✅ Good",IF(B58>0.5,"⚠️ Needs Work","❌ Poor"))',
        ],
      ]);

    // Calculate averages for CLS
    const clsGoodAvg =
      "=AVERAGE('" + dataSheet.getName() + "'!P2:P" + lastRow + ")";
    const clsP75Avg =
      "=AVERAGE('" + dataSheet.getName() + "'!S2:S" + lastRow + ")";
    dashboardSheet
      .getRange("A59:D59")
      .setValues([
        [
          "CLS",
          clsGoodAvg,
          clsP75Avg,
          '=IF(B59>0.75,"✅ Good",IF(B59>0.5,"⚠️ Needs Work","❌ Poor"))',
        ],
      ]);

    // Calculate averages for FCP
    const fcpGoodAvg =
      "=AVERAGE('" + dataSheet.getName() + "'!T2:T" + lastRow + ")";
    const fcpP75Avg =
      "=AVERAGE('" + dataSheet.getName() + "'!W2:W" + lastRow + ")";
    dashboardSheet
      .getRange("A60:D60")
      .setValues([
        [
          "FCP",
          fcpGoodAvg,
          fcpP75Avg,
          '=IF(B60>0.75,"✅ Good",IF(B60>0.5,"⚠️ Needs Work","❌ Poor"))',
        ],
      ]);

    // Format as percentages
    dashboardSheet.getRange("B57:B60").setNumberFormat("0.00%");

    Logger.log("Created summary statistics");
  } catch (error) {
    Logger.log("Failed to create summary stats: " + error.message);
  }
}
