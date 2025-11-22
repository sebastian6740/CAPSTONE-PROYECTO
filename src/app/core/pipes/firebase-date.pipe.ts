import { Pipe, PipeTransform } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';

@Pipe({
  name: 'firebaseDate',
  standalone: true
})
export class FirebaseDatePipe implements PipeTransform {
  transform(value: Date | Timestamp | string | undefined | null): Date | null {
    if (!value) {
      return null;
    }

    if (value instanceof Timestamp) {
      return value.toDate();
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      return new Date(value);
    }

    return null;
  }
}
