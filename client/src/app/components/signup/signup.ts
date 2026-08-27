import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  templateUrl: './signup.html',
  styleUrls: ['./signup.css'] // using the same CSS structure as login
})
export class SignupComponent {
  signupForm: FormGroup;
  error: string = '';
  message: string = '';
  isSubmitting = false;

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    this.signupForm = this.fb.group({
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  onSubmit() {
    if (this.signupForm.valid) {
      this.isSubmitting = true;
      this.error = '';
      this.authService.signup(this.signupForm.value).subscribe({
        next: (res) => {
          this.message = res.message;
          this.isSubmitting = false;
          setTimeout(() => this.router.navigate(['/login']), 1500);
        },
        error: (err) => {
          this.error = err.error?.message || err.error?.error || 'Signup failed';
          this.isSubmitting = false;
        }
      });
    }
  }
}
