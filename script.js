document
  .getElementById("csvFileInput")
  .addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (!file) {
      alert("No file selected!");
      return;
    }
    if (!containsWord(file.name, "Sales")) {
      alert(
        "Please select a Sales CSV file (the file name must include the word 'Sales'"
      );
      return;
    }
    updateEndDateFromFileName(file.name, "endDate");
  });

document
  .getElementById("csvFileInputStaff")
  .addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (!file) {
      alert("No file selected!");
      return;
    }
    if (!containsWord(file.name, "Timesheet")) {
      alert(
        "Please select a Timesheet Report CSV file (the file name must include the word 'Timesheet'"
      );
      return;
    }
    updateEndDateFromFileName(file.name, "endDateStaff");
  });

// Process the CSV content and convert it to TSV format
function csvToTsv(parsedCsv) {
  let tsvString = "";

  // Iterate over each row
  parsedCsv.data.forEach((rowArray) => {
    // rowArray is an array representing column values of the row
    const rowString =
      rowArray
        .map((cell) => {
          // Convert undefined values to empty string and escape special characters
          const cellValue = cell === undefined ? "" : cell.toString();
          return cellValue.replace(/(\r\n|\n|\r|\t)/gm, " ");
        })
        .join("\t") + "\n"; // Join with tabs to create a TSV format row
    tsvString += rowString;
  });

  return tsvString;
}

document.getElementById("processBtn").addEventListener("click", function () {
  const endDate = new Date(document.getElementById("endDate").value);
  if (isNaN(endDate)) {
    alert("Please enter valid dates.");
    return;
  }
  let startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);
  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);

  if (!validateDates(startDate, endDate)) {
    alert(
      "Start date must be a Monday and end date must be a Sunday, 6 days apart."
    );
    return;
  }

  const fileInput = document.getElementById("csvFileInput");
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Please select a CSV file to process.");
    return;
  }
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = function (e) {
    const content = e.target.result;
    Papa.parse(content, {
      header: false,
      skipEmptyLines: false, // Set to false to keep blank lines
      complete: function (results) {
        const tsvData = csvToTsv(results);
        console.log(tsvData); // You can see the TSV data in the console
        // Now you can proceed with your processing
        const salesData = processCSV(tsvData, startDate, endDate);
        if (salesData) {
          saveJSON(
            salesData,
            `Sales Summary ${startDateStr} to ${endDateStr}.json`
          );
        }
      },
    });
  };
  reader.readAsText(file);
});

function processCSV(csvContent, startDate, endDate) {
  const rows = csvContent.split("\n");
  let totalNetSales = null;
  const staffSales = [];
  const servicesSales = [];
  const productSales = [];
  const clinicName = document.getElementById("clinic-name").value;
  if (!clinicName) {
    alert("Please enter a clinic name.");
    return;
  }
  clinicName = clinicName.trim();
  rows.forEach((row, index) => {
    // get all the columns of the row
    const columns = row.split("\t").map((cell) => cell.trim());

    if (columns.includes("TotalNetSalesForThePeriod")) {
      // found the row with the total net sales
      totalNetSales =
        rows[index + 1].split("\t")[
          parseNumericValue(columns.indexOf("TotalNetSalesForThePeriod"))
        ];
    }
  });

  // summary by staff member
  rows.forEach((row, index) => {
    // get all the columns of the row
    const columns = row.split("\t").map((cell) => cell.trim());

    if (columns.includes("LocationName")) {
      // found the row with the headers of the summary by Staff Member
      if (columns.includes("StaffMemberName")) {
        for (let i = index + 1; i < rows.length; i++) {
          const staffColumns = rows[i].split("\t").map((cell) => cell.trim()); // Should split the current staff row
          if (staffColumns[0] === clinicName && staffColumns[2]) {
            staffSales.push({
              StaffMemberName: staffColumns[2],
              StaffTotal: parseNumericValue(staffColumns[3]),
            });
          } else {
            // run out of data. stop the loop
            break;
          }
        }
      }
    }
  });

  // Services and Treatments
  rows.forEach((row, index) => {
    // get all the columns of the row
    const columns = row.split("\t").map((cell) => cell.trim());

    if (columns.includes("BookedServiceItemName")) {
      // found the row with the headers of the services table
      const itemNameColumnIndex = columns.indexOf("BookedServiceItemName");
      const quantityColumnIndex = columns.indexOf("BookedServiceQuantity");
      const grossAmountColumnIndex = columns.indexOf(
        "BookedServiceGrossAmount"
      );
      const lessDiscountsAmountColumnIndex = columns.indexOf(
        "BookedServiceLessDiscounts"
      );
      const taxAmountColumnIndex = columns.indexOf("BookedServiceTaxAmount");
      const netAmountColumnIndex = columns.indexOf("BookedServiceNetAmount");
      for (let i = index + 1; i < rows.length; i++) {
        const servicesColumns = rows[i].split("\t").map((cell) => cell.trim());
        if (servicesColumns[0] && servicesColumns[1]) {
          servicesSales.push({
            ServiceItemName: servicesColumns[itemNameColumnIndex],
            Quantity: parseNumericValue(servicesColumns[quantityColumnIndex]),
            GrossAmount: parseNumericValue(
              servicesColumns[grossAmountColumnIndex]
            ),
            LessDiscounts: parseNumericValue(
              servicesColumns[lessDiscountsAmountColumnIndex]
            ),
            TaxAmount: parseNumericValue(servicesColumns[taxAmountColumnIndex]),
            NetAmount: parseNumericValue(servicesColumns[netAmountColumnIndex]),
          });
        } else {
          // run out of data. stop the loop
          break;
        }
      }
    }
  });

  // Product Sales
  rows.forEach((row, index) => {
    // get all the columns of the row
    const columns = row.split("\t").map((cell) => cell.trim());

    if (columns.includes("ProductCategory")) {
      // found the row with the headers of the products table
      const itemNameColumnIndex = columns.indexOf("ProductItemName");
      const quantityColumnIndex = columns.indexOf("ProductQuantity");
      const grossAmountColumnIndex = columns.indexOf("ProductGrossAmount");
      const lessDiscountsAmountColumnIndex = columns.indexOf(
        "ProductLessDiscounts"
      );
      const taxAmountColumnIndex = columns.indexOf("ProductTaxAmount");
      const netAmountColumnIndex = columns.indexOf("ProductNetAmount");
      for (let i = index + 1; i < rows.length; i++) {
        const productColumns = rows[i].split("\t").map((cell) => cell.trim());
        if (productColumns[1] && productColumns[2]) {
          productSales.push({
            ProductItemName: productColumns[itemNameColumnIndex],
            Quantity: parseNumericValue(productColumns[quantityColumnIndex]),
            GrossAmount: parseNumericValue(
              productColumns[grossAmountColumnIndex]
            ),
            LessDiscounts: parseNumericValue(
              productColumns[lessDiscountsAmountColumnIndex]
            ),
            TaxAmount: parseNumericValue(productColumns[taxAmountColumnIndex]),
            NetAmount: parseNumericValue(productColumns[netAmountColumnIndex]),
          });
        } else {
          // run out of data. stop the loop
          break;
        }
      }
    }
  });

  if (totalNetSales) {
    return {
      StartDate: formatDateToISO(startDate),
      EndDate: formatDateToISO(endDate),
      TotalNetSalesForThePeriod: totalNetSales,
      StaffSales: staffSales,
      ServiceSales: servicesSales,
      ProductSales: productSales,
    };
  } else {
    alert("Could not find TotalNetSalesForThePeriod in the CSV.");
    return null;
  }
}

document
  .getElementById("processBtnStaff")
  .addEventListener("click", function () {
    const endDate = new Date(document.getElementById("endDateStaff").value);
    if (isNaN(endDate)) {
      alert("Please enter valid dates.");
      return;
    }
    let startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    if (!validateDates(startDate, endDate)) {
      alert(
        "Start date must be a Monday and end date must be a Sunday, 6 days apart."
      );
      return;
    }

    const fileInput = document.getElementById("csvFileInputStaff");
    if (!fileInput.files || fileInput.files.length === 0) {
      alert("Please select a CSV file to process.");
      return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
      const content = e.target.result;
      Papa.parse(content, {
        header: false,
        skipEmptyLines: false, // Set to false to keep blank lines
        complete: function (results) {
          const tsvData = csvToTsv(results);
          const staffData = processCSVStaff(tsvData, startDate, endDate);
          if (staffData) {
            saveJSON(
              staffData,
              `Staff Summary ${startDateStr} to ${endDateStr}.json`
            );
          }
        },
      });
    };
    reader.readAsText(file);
  });

function processCSVStaff(csvContent, startDate, endDate) {
  const rows = csvContent.split("\n");
  const staffSchedules = [];
  const clinicName = document.getElementById("clinic-name").value;
  if (!clinicName) {
    alert("Please enter a clinic name.");
    return;
  }
  clinicName = clinicName.trim();
  rows.forEach((row, index) => {
    // get all the columns of the row
    const columns = row.split("\t").map((cell) => cell.trim());
    const staffNameColumnIndex = 1;
    const dateColumnIndex = 2;
    const startTimeColumnIndex = 3;
    const endTimeColumnIndex = 4;
    const busyTimeColumnIndex = 6;
    const breakTimeColumnIndex = 7;
    if (columns.includes(clinicName)) {
      const scheduleColumns = row.split("\t").map((cell) => cell.trim());
      if (scheduleColumns[1] && scheduleColumns[2]) {
        const startTime = scheduleColumns[startTimeColumnIndex];
        const endTime = scheduleColumns[endTimeColumnIndex];
        const busyTime = minutesFromTimeString(
          scheduleColumns[busyTimeColumnIndex]
        );
        const breakTime = minutesFromTimeString(
          scheduleColumns[breakTimeColumnIndex]
        );
        const minutesWorked = calculateMinutesBetweenTimes(startTime, endTime);

        staffSchedules.push({
          BookingList: scheduleColumns[staffNameColumnIndex],
          Date: convertDateToISO(scheduleColumns[dateColumnIndex]),
          StartTime: startTime,
          EndTime: endTime,
          ScheduleTotalMinutes: minutesWorked,
          BreaksMinutes: breakTime + busyTime,
          NetConsultingTimeMinutes: minutesWorked - (breakTime + busyTime),
          NetConsultingTimeHours: convertMinutesToHours(
            minutesWorked - (breakTime + busyTime)
          ),
        });
      }
    }
  });

  if (staffSchedules.length === 0) {
    alert("Could not find any staff schedules in the CSV.");
    return null;
  }

  return {
    StartDate: formatDateToISO(startDate),
    EndDate: formatDateToISO(endDate),
    StaffSchedules: staffSchedules,
  };
}

function saveJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function formatDateToISO(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0"); // Months are 0-indexed, add 1 to get the correct month
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validateDates(startDate, endDate) {
  const dayDifference = (endDate - startDate) / (1000 * 3600 * 24);
  const isStartMonday = startDate.getDay() === 1;
  const isEndSunday = endDate.getDay() === 0;
  return isStartMonday && isEndSunday && dayDifference === 6;
}

function validateDates(startDate, endDate) {
  const dayDifference = (endDate - startDate) / (1000 * 3600 * 24);
  const isStartMonday = startDate.getDay() === 1; // In JavaScript, 0 is Sunday, 1 is Monday, etc.
  const isEndSunday = endDate.getDay() === 0;

  return isStartMonday && isEndSunday && dayDifference === 6;
}
function formatDateToISO(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0"); // Months are 0-indexed, add 1 to get the correct month
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseNumericValue(value) {
  console.log(`Value to parseNumericValue: ${value}`);

  if (value === undefined || value === null || value === "") {
    return "";
  }

  // Convert value to a string to safely use the replace method
  let valueStr = value.toString();

  // Remove commas
  let cleanedValue = valueStr.replace(/,/g, "");

  // Use parseInt for integers, parseFloat for floats
  let numericValue = cleanedValue.includes(".")
    ? parseFloat(cleanedValue)
    : parseInt(cleanedValue);

  // Check if the parsed value is a number
  if (isNaN(numericValue)) {
    return valueStr; // Return the original value if it's not a number
  }
  return numericValue; // Return the numeric value
}

function updateEndDateFromFileName(fileName, inputElementName) {
  console.log(fileName);
  // Regular expression for matching ISO date format (YYYY-MM-DD)
  const dateRegex = /\d{4}-\d{2}-\d{2}/;

  // Search for a date in the file name
  const match = fileName.match(dateRegex);

  if (match) {
    // If a date is found, update the 'endDate' input element
    document.getElementById(inputElementName).value = match[0];
  }
}

function calculateMinutesBetweenTimes(time1, time2) {
  // Split the time strings into hours and minutes
  const [hours1, minutes1] = time1.split(":").map(Number);
  const [hours2, minutes2] = time2.split(":").map(Number);

  // Create Date objects for each time (using the same arbitrary date)
  const date1 = new Date(2000, 0, 1, hours1, minutes1); // Year, month, day, hours, minutes
  const date2 = new Date(2000, 0, 1, hours2, minutes2);

  // Calculate the difference in milliseconds
  const diffMs = Math.abs(date2 - date1);

  // Convert milliseconds to minutes
  return diffMs / (1000 * 60);
}

function minutesFromTimeString(timeString) {
  if (!timeString) {
    return 0;
  }
  if (!timeString.includes(":")) {
    return 0;
  }
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
}

function convertDateToISO(dateString) {
  // Remove the day of the week and the comma after it
  let formattedDateString = dateString.replace(/^[a-zA-Z]{3},\s/, "");

  // Replace the comma after the day with a space
  formattedDateString = formattedDateString.replace(/,\s/g, " ");

  // Parse the date string into a Date object
  const date = new Date(formattedDateString);

  // Format the Date object into YYYY-MM-DD
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function convertMinutesToHours(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${mins.toString().padStart(2, "0")}`;
}

function containsWord(fileName, word) {
  // Escape special regex characters in the word to avoid errors
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Dynamically create a new RegExp object with the 'i' flag for case-insensitivity
  const regex = new RegExp(escapedWord, "i");

  return regex.test(fileName);
}

document.addEventListener("DOMContentLoaded", () => {
  // Load clinic name from localStorage on page load
  const clinicName = localStorage.getItem("clinicName");
  if (clinicName) {
    document.getElementById("clinic-name").value = clinicName;
  }

  // Add event listener for form submission
  document
    .getElementById("clinic-form")
    .addEventListener("submit", function (event) {
      event.preventDefault(); // Prevent the form from submitting the traditional way

      const name = document.getElementById("clinic-name").value;
      if (name) {
        // Save the clinic name to localStorage
        localStorage.setItem("clinicName", name);
        alert("Clinic name saved!");
      }
    });
});
