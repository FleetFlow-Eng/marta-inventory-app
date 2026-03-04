import { db } from './firebaseConfig';
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export const HAMILTON_FLEET = ["1625","1628","1629","1631","1632","1633","1634","1635","1636","1637","1638","1639","1640","1641","1642","1643","1644","1645","1646","1647","1648","1660","1802","1803","1804","1805","1806","1807","1808","1809","1810","1811","1812","1813","1815","1817","1818","1819","1820","1821","1822","1823","1824","1826","1827","1828","1829","1830","1831","1832","1833","1834","1835","1836","1837","1838","1839","1840","1841","1842","1843","1844","1845","1846","1847","1848","1849","1850","1851","1852","1853","1854","1855","1856","1858","1859","1860","1861","1862","1863","1864","1865","1867","1868","1870","1871","1872","1873","1874","1875","1876","1877","1878","1879","1880","1881","1883","1884","1885","1887","1888","1889","1895","1909","1912","1913","1921","1922","1923","1924","1925","1926","1927","1928","1929","1930","1931","1932","1933","1935","1951","1958","1959","7021","7022","7023","7024","7025","7026","7027","7028","7029","7030","7031","7033","7092","7093","7094","7095","7096","7097","7098","7099","7102","7103","7104","7105","1406","1408","1434","1440","2326","2343","2593"];
export const ADMIN_EMAILS = ['anetowestfield@gmail.com', 'admin@fleetflow.services'];

export const logActivity = async (userEmail: string, category: string, target: string, action: string, details: string) => {
    if (!userEmail) return;
    try { await addDoc(collection(db, "activity_logs"), { user: userEmail, category, target, action, details, timestamp: serverTimestamp() }); } catch(e) { console.error(e); }
};

export const logHistory = async (busNumber: string, action: string, details: string, userEmail: string) => {
    if (!busNumber) return;
    try { 
        await addDoc(collection(db, "buses", busNumber, "history"), { action, details, user: userEmail, timestamp: serverTimestamp() }); 
        await logActivity(userEmail, 'BUS', `Bus #${busNumber}`, action, details);
    } catch (err) { console.error(err); }
};

export const formatTime = (ts: any) => ts ? (ts.toDate ? ts.toDate() : new Date(ts)).toLocaleString() : 'Just now';

export const getBusSpecs = (num: string) => parseInt(num) > 1950 && parseInt(num) < 1960 ? { length: "30'" } : parseInt(num) < 1936 ? { length: "35'" } : { length: "40'" };

export const calculateDaysOOS = (start: string) => start ? Math.max(0, Math.ceil((new Date().getTime() - new Date(start).getTime()) / (1000 * 3600 * 24))) : 0;