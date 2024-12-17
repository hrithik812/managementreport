const formatDate = (isoDate) => {
     
    const date = new Date(isoDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const updateDateToFirst = (date) => {
    const [year, month] = date.split('-'); // Split into year, month, and day
    return `${year}-${month}-01`; // Concatenate with "01"
};
module.exports={
    formatDate,updateDateToFirst
}