import csv from 'csv-parser';
import { Readable } from 'stream';

class Parse {
    private parseCSV(buffer: Buffer): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const results: any[] = [];
            Readable.from(buffer)
            .pipe(csv())
            .on('data', (d) => results.push(d))
            .on('end', () => resolve(results))
            .on('error', reject);
        });
    }

    private parseCsvDateTime(dateStr: string, timeStr: string): string {
        if (!dateStr) return new Date().toISOString().slice(0, 19).replace('T', ' ');
        const parts = dateStr.trim().split('/');
        if (parts.length === 3) {
            const [day, month, year] = parts;
            const time = timeStr?.trim() || '00:00';
            return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')} ${time}:00`;
        }
        return dateStr;
    }
}

export default Parse;